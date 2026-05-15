-- SyncDesk: real task lifecycle timestamps
-- Apply in Supabase → SQL Editor (service role) or via Supabase CLI.
--
-- Adds `created_at` and `completed_at` to `board_tasks` so the activity feed,
-- velocity chart and productivity heatmap can be computed from real events.
-- `created_at` defaults to `now()` on new inserts; legacy rows keep NULL until
-- touched again (no guessed backfill). `completed_at` is maintained by the
-- trigger below whenever `column_id` enters or leaves `completed`.

alter table public.board_tasks
  add column if not exists created_at timestamptz;

alter table public.board_tasks
  add column if not exists completed_at timestamptz;

-- New rows pick up `now()` automatically when the client omits `created_at`.
-- Existing rows stay NULL so the activity feed does not fabricate a "created"
-- event from a guessed backfill timestamp.
alter table public.board_tasks
  alter column created_at set default now();

-- Trigger: when a task is in the `completed` column, ensure `completed_at` is
-- set (once). When it leaves that column, clear `completed_at`.
create or replace function public.board_tasks_sync_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.column_id <> 'completed' then
    new.completed_at := null;
  elsif new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists board_tasks_completed_at_tg on public.board_tasks;
create trigger board_tasks_completed_at_tg
  before insert or update of column_id, completed_at on public.board_tasks
  for each row execute procedure public.board_tasks_sync_completed_at();
