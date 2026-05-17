-- Production notification inbox: schema, RLS, RPC, collaboration triggers, realtime.

-- ---------------------------------------------------------------------------
-- Schema upgrade (kind/body/read_at → type/message/is_read + context columns)
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists board_id uuid references public.boards(id) on delete cascade,
  add column if not exists task_id text,
  add column if not exists type text,
  add column if not exists message text,
  add column if not exists is_read boolean not null default false;

update public.notifications
set
  type = coalesce(type, kind),
  message = coalesce(message, body),
  is_read = case when is_read then true else read_at is not null end
where type is null or message is null;

alter table public.notifications
  alter column type set not null,
  alter column title set not null;

alter table public.notifications drop column if exists kind;
alter table public.notifications drop column if exists body;
alter table public.notifications drop column if exists read_at;
alter table public.notifications drop column if exists metadata;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc)
  where is_read = false;

-- ---------------------------------------------------------------------------
-- RLS: users read/update own rows; inserts only via security definer
-- ---------------------------------------------------------------------------
drop policy if exists "notifications_all_own" on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._notification_actor_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(p.display_name), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Someone'
  )
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;
$$;

create or replace function public._workspace_admin_user_ids(p_workspace_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.user_id
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.role in ('owner', 'admin');
$$;

create or replace function public._workspace_member_user_ids(p_workspace_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.user_id
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id;
$$;

create or replace function public._user_id_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Batch insert (called from app + triggers)
-- ---------------------------------------------------------------------------
create or replace function public.create_notifications(p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  row jsonb;
  inserted int := 0;
  v_actor uuid;
  v_recipient uuid;
begin
  v_actor := auth.uid();

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  for row in select * from jsonb_array_elements(p_rows)
  loop
    v_recipient := (row->>'user_id')::uuid;
    if v_recipient is null then
      continue;
    end if;

    -- Never notify yourself
    if v_recipient = coalesce((row->>'actor_id')::uuid, v_actor) then
      continue;
    end if;

    insert into public.notifications (
      user_id,
      actor_id,
      workspace_id,
      board_id,
      task_id,
      type,
      title,
      message,
      is_read
    )
    values (
      v_recipient,
      coalesce((row->>'actor_id')::uuid, v_actor),
      nullif(row->>'workspace_id', '')::uuid,
      nullif(row->>'board_id', '')::uuid,
      nullif(row->>'task_id', ''),
      coalesce(row->>'type', 'system'),
      coalesce(row->>'title', 'Notification'),
      nullif(row->>'message', ''),
      false
    );
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

grant execute on function public.create_notifications(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-side triggers (member joined, workspace invite, invite accepted)
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_workspace_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  ws_name text;
  ws_slug text;
  admin_id uuid;
  payload jsonb := '[]'::jsonb;
begin
  select w.name, w.slug into ws_name, ws_slug
  from public.workspaces w
  where w.id = new.workspace_id;

  actor_name := public._notification_actor_name(new.user_id);

  for admin_id in
    select a.user_id
    from public._workspace_admin_user_ids(new.workspace_id) a(user_id)
    where a.user_id <> new.user_id
  loop
    payload := payload || jsonb_build_array(
      jsonb_build_object(
        'user_id', admin_id::text,
        'actor_id', new.user_id::text,
        'workspace_id', new.workspace_id::text,
        'type', 'member_joined',
        'title', 'New workspace member',
        'message', actor_name || ' joined ' || coalesce(ws_name, 'the workspace')
      )
    );
  end loop;

  if jsonb_array_length(payload) > 0 then
    perform public.create_notifications(payload);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_workspace_member_joined on public.workspace_members;
create trigger trg_notify_workspace_member_joined
  after insert on public.workspace_members
  for each row
  execute function public.trg_notify_workspace_member_joined();

create or replace function public.trg_notify_workspace_invite_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitee_id uuid;
  inviter_name text;
  ws_name text;
begin
  invitee_id := public._user_id_for_email(new.invited_email);
  if invitee_id is null then
    return new;
  end if;

  if invitee_id = new.invited_by then
    return new;
  end if;

  select w.name into ws_name from public.workspaces w where w.id = new.workspace_id;
  inviter_name := public._notification_actor_name(new.invited_by);

  perform public.create_notifications(jsonb_build_array(
    jsonb_build_object(
      'user_id', invitee_id::text,
      'actor_id', new.invited_by::text,
      'workspace_id', new.workspace_id::text,
      'type', 'workspace_invitation',
      'title', 'Workspace invitation',
      'message', inviter_name || ' invited you to ' || coalesce(ws_name, 'a workspace')
    )
  ));

  return new;
end;
$$;

drop trigger if exists trg_notify_workspace_invite_created on public.workspace_invites;
create trigger trg_notify_workspace_invite_created
  after insert on public.workspace_invites
  for each row
  when (new.status = 'pending')
  execute function public.trg_notify_workspace_invite_created();

create or replace function public.trg_notify_workspace_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepter_name text;
  ws_name text;
begin
  if old.status = 'pending' and new.status = 'accepted' and new.invited_by is not null then
    if new.accepted_by is not null and new.accepted_by = new.invited_by then
      return new;
    end if;

    select w.name into ws_name from public.workspaces w where w.id = new.workspace_id;
    accepter_name := public._notification_actor_name(coalesce(new.accepted_by, auth.uid()));

    perform public.create_notifications(jsonb_build_array(
      jsonb_build_object(
        'user_id', new.invited_by::text,
        'actor_id', coalesce(new.accepted_by, auth.uid())::text,
        'workspace_id', new.workspace_id::text,
        'type', 'invite_accepted',
        'title', 'Invitation accepted',
        'message', accepter_name || ' accepted your invite to ' || coalesce(ws_name, 'the workspace')
      )
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_workspace_invite_accepted on public.workspace_invites;
create trigger trg_notify_workspace_invite_accepted
  after update on public.workspace_invites
  for each row
  execute function public.trg_notify_workspace_invite_accepted();

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

alter table public.notifications replica identity full;
