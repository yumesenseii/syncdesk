-- Activity: actor snapshots, meeting events, task_deleted

alter table public.activity_events
  add column if not exists actor_name text,
  add column if not exists actor_avatar_url text,
  add column if not exists meeting_id uuid references public.calendar_meetings (id) on delete set null;

create index if not exists activity_events_meeting_id_idx
  on public.activity_events (meeting_id)
  where meeting_id is not null;

alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;

alter table public.activity_events
  add constraint activity_events_event_type_check check (
    event_type in (
      'workspace_created',
      'workspace_updated',
      'member_invited',
      'member_joined',
      'member_removed',
      'board_created',
      'board_updated',
      'board_archived',
      'board_deleted',
      'task_created',
      'task_updated',
      'task_completed',
      'task_moved',
      'task_deleted',
      'task_assigned',
      'due_date_changed',
      'checklist_completed',
      'comment_added',
      'meeting_created',
      'meeting_updated',
      'meeting_deleted'
    )
  );

-- Backfill actor names from profiles for existing rows
update public.activity_events ae
set
  actor_name = coalesce(nullif(trim(p.display_name), ''), ae.actor_name),
  actor_avatar_url = coalesce(p.avatar_url, ae.actor_avatar_url)
from public.profiles p
where p.id = ae.actor_user_id
  and ae.actor_name is null;

-- Client RPC: log with optional board/task/meeting + actor snapshot columns
create or replace function public.log_activity_event(
  p_workspace_id uuid,
  p_event_type text,
  p_summary text,
  p_board_id uuid default null,
  p_task_id uuid default null,
  p_meeting_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_name text default null,
  p_actor_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid;
  v_name text;
  v_avatar text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Not a workspace member';
  end if;

  select
    coalesce(nullif(trim(p_actor_name), ''), nullif(trim(p.display_name), '')),
    coalesce(p_actor_avatar_url, p.avatar_url)
  into v_name, v_avatar
  from public.profiles p
  where p.id = v_actor;

  insert into public.activity_events (
    workspace_id,
    board_id,
    task_id,
    meeting_id,
    actor_user_id,
    actor_name,
    actor_avatar_url,
    event_type,
    summary,
    metadata
  )
  values (
    p_workspace_id,
    p_board_id,
    p_task_id,
    p_meeting_id,
    v_actor,
    v_name,
    v_avatar,
    p_event_type,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_activity_event(uuid, text, text, uuid, uuid, uuid, jsonb, text, text) to authenticated;

-- Definer helper (invites / triggers): resolve actor from profiles
create or replace function public.insert_activity_event_definer(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb,
  p_board_id uuid default null,
  p_task_id uuid default null,
  p_meeting_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_avatar text;
begin
  select nullif(trim(p.display_name), ''), p.avatar_url
  into v_name, v_avatar
  from public.profiles p
  where p.id = p_actor_user_id;

  insert into public.activity_events (
    workspace_id,
    board_id,
    task_id,
    meeting_id,
    actor_user_id,
    actor_name,
    actor_avatar_url,
    event_type,
    summary,
    metadata
  )
  values (
    p_workspace_id,
    p_board_id,
    p_task_id,
    p_meeting_id,
    p_actor_user_id,
    v_name,
    v_avatar,
    p_event_type,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_activity_event_definer(uuid, uuid, text, text, jsonb, uuid, uuid, uuid) to authenticated;
