-- SyncDesk: persistent workspace activity feed
-- Apply via Supabase CLI. Enable realtime on activity_events for live feeds.

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  board_id uuid references public.boards (id) on delete set null,
  task_id uuid references public.board_tasks (id) on delete set null,
  actor_user_id uuid not null references auth.users (id) on delete set null,
  event_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_events_event_type_check check (
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
      'task_assigned',
      'due_date_changed',
      'checklist_completed',
      'comment_added'
    )
  )
);

create index if not exists activity_events_workspace_created_idx
  on public.activity_events (workspace_id, created_at desc);

create index if not exists activity_events_board_id_idx
  on public.activity_events (board_id)
  where board_id is not null;

create index if not exists activity_events_task_id_idx
  on public.activity_events (task_id)
  where task_id is not null;

create index if not exists activity_events_actor_user_id_idx
  on public.activity_events (actor_user_id, created_at desc);

create index if not exists activity_events_event_type_idx
  on public.activity_events (event_type);

alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select_member" on public.activity_events;
create policy "activity_events_select_member"
  on public.activity_events
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "activity_events_insert_member" on public.activity_events;
create policy "activity_events_insert_member"
  on public.activity_events
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and actor_user_id = auth.uid()
  );

-- Log member_joined when an invite is accepted (server-side, no duplicate client logs).
create or replace function public.log_activity_event(
  p_workspace_id uuid,
  p_event_type text,
  p_summary text,
  p_board_id uuid default null,
  p_task_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Not a workspace member';
  end if;

  insert into public.activity_events (
    workspace_id,
    board_id,
    task_id,
    actor_user_id,
    event_type,
    summary,
    metadata
  )
  values (
    p_workspace_id,
    p_board_id,
    p_task_id,
    v_actor,
    p_event_type,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_activity_event(uuid, text, text, uuid, uuid, jsonb) to authenticated;
