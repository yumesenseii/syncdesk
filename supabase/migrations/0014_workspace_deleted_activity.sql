-- Keep activity history when a workspace is deleted (SET NULL instead of CASCADE delete)

alter table public.activity_events
  drop constraint if exists activity_events_workspace_id_fkey;

alter table public.activity_events
  alter column workspace_id drop not null;

alter table public.activity_events
  add constraint activity_events_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces (id) on delete set null;

alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;

alter table public.activity_events
  add constraint activity_events_event_type_check check (
    event_type in (
      'workspace_created',
      'workspace_updated',
      'workspace_deleted',
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

-- Orphan workspace_deleted rows: visible to the actor who deleted
drop policy if exists "activity_events_select_orphan_delete" on public.activity_events;
create policy "activity_events_select_orphan_delete"
  on public.activity_events
  for select
  using (
    workspace_id is null
    and event_type = 'workspace_deleted'
    and actor_user_id = auth.uid()
  );
