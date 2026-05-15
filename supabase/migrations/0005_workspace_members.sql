-- SyncDesk: workspace-level membership (source of truth for board access)
-- Apply via Supabase CLI or SQL editor. Enable realtime on workspace_members if desired.

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- Legacy installs may have created workspace_id as text.
do $$
begin
  if exists (
    select 1
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'workspace_members'
       and c.column_name = 'workspace_id'
       and c.data_type <> 'uuid'
  ) then
    alter table public.workspace_members
      alter column workspace_id type uuid using workspace_id::uuid;
  end if;
exception
  when others then
    raise notice 'workspace_members.workspace_id type alignment skipped: %', sqlerrm;
end;
$$;

create index if not exists workspace_members_workspace_id_idx
  on public.workspace_members (workspace_id);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

alter table public.workspace_members enable row level security;

-- ---------------------------------------------------------------------------
-- Membership helpers (UUID workspace_id)
-- ---------------------------------------------------------------------------
drop function if exists public.is_workspace_member(text);
drop function if exists public.is_workspace_owner(text);
drop function if exists public.can_manage_workspace_members(text);

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members wm
     where wm.workspace_id = p_workspace_id
       and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspaces w
     where w.id = p_workspace_id
       and w.owner_id = auth.uid()
  );
$$;

create or replace function public.can_manage_workspace_members(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_workspace_owner(p_workspace_id)
      or exists (
        select 1
          from public.workspace_members wm
         where wm.workspace_id = p_workspace_id
           and wm.user_id = auth.uid()
           and wm.role in ('owner', 'admin')
      );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.can_manage_workspace_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- workspace_members RLS
-- ---------------------------------------------------------------------------
drop policy if exists "workspace_members_select" on public.workspace_members;
drop policy if exists "workspace_members_insert" on public.workspace_members;
drop policy if exists "workspace_members_update" on public.workspace_members;
drop policy if exists "workspace_members_delete" on public.workspace_members;

create policy "workspace_members_select"
  on public.workspace_members
  for select
  using (
    public.is_workspace_member(workspace_id)
    or public.is_workspace_owner(workspace_id)
  );

create policy "workspace_members_insert"
  on public.workspace_members
  for insert
  with check (public.can_manage_workspace_members(workspace_id));

create policy "workspace_members_update"
  on public.workspace_members
  for update
  using (public.can_manage_workspace_members(workspace_id))
  with check (public.can_manage_workspace_members(workspace_id));

create policy "workspace_members_delete"
  on public.workspace_members
  for delete
  using (public.can_manage_workspace_members(workspace_id));

-- ---------------------------------------------------------------------------
-- Backfill: owners are workspace members
-- ---------------------------------------------------------------------------
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
  from public.workspaces w
 where not exists (
   select 1
     from public.workspace_members wm
    where wm.workspace_id = w.id
      and wm.user_id = w.owner_id
 );

-- Sync member_ids from accepted invites that have accepted_by set
insert into public.workspace_members (workspace_id, user_id, role)
select wi.workspace_id, wi.accepted_by, wi.role
  from public.workspace_invites wi
 where wi.status = 'accepted'
   and wi.accepted_by is not null
 on conflict (workspace_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- workspaces RLS: members can read shared workspaces
-- ---------------------------------------------------------------------------
drop policy if exists "workspaces_all_own" on public.workspaces;
drop policy if exists "workspaces_select_member" on public.workspaces;
drop policy if exists "workspaces_insert_own" on public.workspaces;
drop policy if exists "workspaces_update_owner" on public.workspaces;
drop policy if exists "workspaces_delete_owner" on public.workspaces;

create policy "workspaces_select_member"
  on public.workspaces
  for select
  using (
    owner_id = auth.uid()
    or public.is_workspace_member(id)
  );

create policy "workspaces_insert_own"
  on public.workspaces
  for insert
  with check (owner_id = auth.uid());

create policy "workspaces_update_owner"
  on public.workspaces
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "workspaces_delete_owner"
  on public.workspaces
  for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- boards RLS: any workspace member can collaborate
-- ---------------------------------------------------------------------------
drop policy if exists "boards_all_own" on public.boards;
drop policy if exists "boards_select_member" on public.boards;
drop policy if exists "boards_insert_member" on public.boards;
drop policy if exists "boards_update_member" on public.boards;
drop policy if exists "boards_delete_member" on public.boards;

create policy "boards_select_member"
  on public.boards
  for select
  using (public.is_workspace_member(workspace_id));

create policy "boards_insert_member"
  on public.boards
  for insert
  with check (public.is_workspace_member(workspace_id));

create policy "boards_update_member"
  on public.boards
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "boards_delete_member"
  on public.boards
  for delete
  using (
    public.is_workspace_owner(workspace_id)
    or exists (
      select 1
        from public.workspace_members wm
       where wm.workspace_id = boards.workspace_id
         and wm.user_id = auth.uid()
         and wm.role in ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- board_tasks RLS: workspace members via board
-- ---------------------------------------------------------------------------
drop policy if exists "board_tasks_all_own" on public.board_tasks;
drop policy if exists "board_tasks_select_member" on public.board_tasks;
drop policy if exists "board_tasks_insert_member" on public.board_tasks;
drop policy if exists "board_tasks_update_member" on public.board_tasks;
drop policy if exists "board_tasks_delete_member" on public.board_tasks;

create policy "board_tasks_select_member"
  on public.board_tasks
  for select
  using (
    exists (
      select 1
        from public.boards b
       where b.id = board_tasks.board_id
         and public.is_workspace_member(b.workspace_id)
    )
  );

create policy "board_tasks_insert_member"
  on public.board_tasks
  for insert
  with check (
    exists (
      select 1
        from public.boards b
       where b.id = board_tasks.board_id
         and public.is_workspace_member(b.workspace_id)
    )
  );

create policy "board_tasks_update_member"
  on public.board_tasks
  for update
  using (
    exists (
      select 1
        from public.boards b
       where b.id = board_tasks.board_id
         and public.is_workspace_member(b.workspace_id)
    )
  )
  with check (
    exists (
      select 1
        from public.boards b
       where b.id = board_tasks.board_id
         and public.is_workspace_member(b.workspace_id)
    )
  );

create policy "board_tasks_delete_member"
  on public.board_tasks
  for delete
  using (
    exists (
      select 1
        from public.boards b
       where b.id = board_tasks.board_id
         and public.is_workspace_member(b.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: workspace co-members can read each other's display info
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_workspace_peer" on public.profiles;

create policy "profiles_select_workspace_peer"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or exists (
      select 1
        from public.workspace_members wm_self
        join public.workspace_members wm_peer
          on wm_peer.workspace_id = wm_self.workspace_id
       where wm_self.user_id = auth.uid()
         and wm_peer.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- workspace_by_slug: members can resolve shared workspaces
-- ---------------------------------------------------------------------------
drop function if exists public.workspace_by_slug(text);

create or replace function public.workspace_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  icon text,
  expanded boolean,
  member_ids text[],
  sort_order int,
  owner_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  select w.id, w.slug, w.name, w.icon, w.expanded, w.member_ids, w.sort_order, w.owner_id
    from public.workspaces w
   where lower(w.slug) = lower(p_slug)
     and (
       w.owner_id = auth.uid()
       or public.is_workspace_member(w.id)
     )
   limit 1
$$;

grant execute on function public.workspace_by_slug(text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_workspace_invite: insert workspace_members (source of truth)
-- ---------------------------------------------------------------------------
drop function if exists public.accept_workspace_invite(text);

-- NOTE: return column MUST NOT be named workspace_id — it shadows the table column
-- and breaks ON CONFLICT (workspace_id, user_id) with "workspace_id is ambiguous".
create or replace function public.accept_workspace_invite(p_token text)
returns table (
  accepted_workspace_id uuid,
  workspace_slug text,
  workspace_name text,
  team_member_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text := lower(coalesce((auth.jwt() ->> 'email')::text, ''));
  v_full_name text;
  v_initials text;
  v_team_id uuid;
  v_existing uuid;
  v_color text;
  v_member_role text;
  v_ws_name text;
  v_ws_slug text;
  v_target_workspace_id uuid;
  v_palette text[] := array[
    'bg-sky-500/15 text-sky-700',
    'bg-violet-500/15 text-violet-700',
    'bg-emerald-500/15 text-emerald-700',
    'bg-amber-500/15 text-amber-800',
    'bg-rose-500/15 text-rose-700',
    'bg-indigo-500/15 text-indigo-700'
  ];
begin
  if v_user_id is null then
    raise exception 'You must be signed in to accept an invitation.';
  end if;
  if p_token is null or length(p_token) = 0 then
    raise exception 'Missing invitation token.';
  end if;

  select wi.*
    into v_invite
    from public.workspace_invites wi
   where wi.token = p_token;

  if not found then
    raise exception 'This invitation no longer exists.';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'This invitation has already been accepted.';
  end if;
  if v_invite.status = 'revoked' then
    raise exception 'This invitation was revoked by the workspace owner.';
  end if;
  if v_invite.status = 'expired' or v_invite.expires_at < now() then
    update public.workspace_invites wi
       set status = 'expired'
     where wi.id = v_invite.id;
    raise exception 'This invitation has expired.';
  end if;

  if v_user_email = '' or v_user_email <> lower(v_invite.invited_email) then
    raise exception 'Sign in with % to accept this invitation.', v_invite.invited_email;
  end if;

  v_target_workspace_id := v_invite.workspace_id;

  v_member_role := case
    when v_invite.role in ('admin', 'viewer', 'member') then v_invite.role
    else 'member'
  end;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_target_workspace_id, v_user_id, v_member_role)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;

  select w.name, w.slug
    into v_ws_name, v_ws_slug
    from public.workspaces w
   where w.id = v_target_workspace_id;

  select coalesce(p.display_name, split_part(coalesce((auth.jwt() ->> 'email')::text, ''), '@', 1), 'Member')
    into v_full_name
    from public.profiles p
   where p.id = v_user_id;

  if v_full_name is null or length(v_full_name) = 0 then
    v_full_name := split_part(v_invite.invited_email, '@', 1);
  end if;

  v_initials := upper(substring(regexp_replace(v_full_name, '[^A-Za-z]', '', 'g'), 1, 2));
  if length(v_initials) = 0 then
    v_initials := upper(substring(v_invite.invited_email, 1, 2));
  end if;

  v_color := v_palette[((abs(hashtext(v_user_email)) % array_length(v_palette, 1)) + 1)];

  select tm.id
    into v_existing
    from public.team_members tm
   where tm.user_id = v_invite.invited_by
     and lower(tm.email) = v_user_email
   limit 1;

  if v_existing is not null then
    v_team_id := v_existing;
    update public.team_members tm
       set name = v_full_name,
           initials = v_initials,
           updated_at = now()
     where tm.id = v_team_id;
  else
    v_team_id := gen_random_uuid();
    insert into public.team_members (id, user_id, name, initials, color, email, updated_at)
    values (v_team_id, v_invite.invited_by, v_full_name, v_initials, v_color, v_invite.invited_email, now());
  end if;

  -- membership is stored in workspace_members (source of truth).
  -- Do not update workspaces.member_ids here — column type may be uuid[] vs text[].

  update public.workspace_invites wi
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = v_user_id
   where wi.id = v_invite.id;

  return query
    select w.id, w.slug, w.name, v_team_id
      from public.workspaces w
     where w.id = v_target_workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;
