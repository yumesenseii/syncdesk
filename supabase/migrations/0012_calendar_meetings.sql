-- SyncDesk: persistent calendar meetings
-- After apply: Database → Replication → enable supabase_realtime for `calendar_meetings`.

create table if not exists public.calendar_meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  attendees jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_meetings_time_order check (end_at > start_at)
);

create index if not exists calendar_meetings_workspace_start_idx
  on public.calendar_meetings (workspace_id, start_at);

create index if not exists calendar_meetings_created_by_idx
  on public.calendar_meetings (created_by);

create or replace function public.set_calendar_meetings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_meetings_updated_at on public.calendar_meetings;
create trigger calendar_meetings_updated_at
  before update on public.calendar_meetings
  for each row
  execute function public.set_calendar_meetings_updated_at();

alter table public.calendar_meetings enable row level security;

drop policy if exists "calendar_meetings_select_member" on public.calendar_meetings;
create policy "calendar_meetings_select_member"
  on public.calendar_meetings
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "calendar_meetings_insert_member" on public.calendar_meetings;
create policy "calendar_meetings_insert_member"
  on public.calendar_meetings
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

drop policy if exists "calendar_meetings_update_member" on public.calendar_meetings;
create policy "calendar_meetings_update_member"
  on public.calendar_meetings
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "calendar_meetings_delete_member" on public.calendar_meetings;
create policy "calendar_meetings_delete_member"
  on public.calendar_meetings
  for delete
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (
      created_by = auth.uid()
      or public.can_manage_workspace_members(workspace_id)
    )
  );
