-- SyncDesk: task ordering + collaboration payloads on board_tasks

alter table public.board_tasks
  add column if not exists sort_order int not null default 0;

alter table public.board_tasks
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.board_tasks
  add column if not exists task_comments jsonb not null default '[]'::jsonb;

create index if not exists board_tasks_board_column_sort_idx
  on public.board_tasks (board_id, column_id, sort_order);

-- Backfill sort_order from updated_at so existing boards keep a stable order.
with ranked as (
  select
    id,
    row_number() over (
      partition by board_id, column_id
      order by coalesce(updated_at, now()), id
    ) - 1 as rn
  from public.board_tasks
)
update public.board_tasks t
   set sort_order = ranked.rn
  from ranked
 where t.id = ranked.id;
