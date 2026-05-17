-- Dedicated task comments with realtime + migrated JSONB history.

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.board_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint task_comments_content_not_empty check (char_length(trim(content)) > 0)
);

create index if not exists task_comments_task_id_created_idx
  on public.task_comments (task_id, created_at desc);

create index if not exists task_comments_user_id_idx
  on public.task_comments (user_id);

alter table public.task_comments enable row level security;

-- Workspace members may read comments on tasks in their workspace boards.
create policy "task_comments_select_member"
  on public.task_comments
  for select
  using (
    exists (
      select 1
        from public.board_tasks bt
        join public.boards b on b.id = bt.board_id
       where bt.id = task_comments.task_id
         and public.is_workspace_member(b.workspace_id)
    )
  );

-- Authors may insert their own comments on accessible tasks.
create policy "task_comments_insert_member"
  on public.task_comments
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.board_tasks bt
        join public.boards b on b.id = bt.board_id
       where bt.id = task_comments.task_id
         and public.is_workspace_member(b.workspace_id)
    )
  );

-- Authors may delete their own comments (optional moderation path).
create policy "task_comments_delete_own"
  on public.task_comments
  for delete
  using (user_id = auth.uid());

-- Migrate legacy JSONB comments on board_tasks into task_comments.
insert into public.task_comments (id, task_id, user_id, content, created_at)
select
  coalesce(
    case
      when (elem->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (elem->>'id')::uuid
      else gen_random_uuid()
    end,
    gen_random_uuid()
  ),
  bt.id,
  coalesce(
    case
      when (elem->>'authorId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (elem->>'authorId')::uuid
      else null
    end,
    bt.user_id
  ),
  coalesce(nullif(trim(elem->>'text'), ''), '(comment)'),
  case
    when (elem->>'createdAt') ~ '^[0-9]+$'
      then to_timestamp((elem->>'createdAt')::bigint / 1000.0)
    else coalesce(bt.updated_at, now())
  end
from public.board_tasks bt
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(bt.task_comments) = 'array' then bt.task_comments
    else '[]'::jsonb
  end
) as elem
where jsonb_array_length(
  case
    when jsonb_typeof(bt.task_comments) = 'array' then bt.task_comments
    else '[]'::jsonb
  end
) > 0
on conflict (id) do nothing;

-- Keep board_tasks.comments_count in sync with task_comments rows.
create or replace function public.sync_board_task_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id uuid;
begin
  v_task_id := coalesce(new.task_id, old.task_id);

  update public.board_tasks bt
     set comments_count = (
       select count(*)::int
         from public.task_comments tc
        where tc.task_id = v_task_id
     ),
         updated_at = now()
   where bt.id = v_task_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_board_task_comments_count on public.task_comments;
create trigger trg_sync_board_task_comments_count
  after insert or delete on public.task_comments
  for each row
  execute function public.sync_board_task_comments_count();

-- Backfill counts after migration.
update public.board_tasks bt
   set comments_count = sub.cnt
  from (
    select task_id, count(*)::int as cnt
      from public.task_comments
     group by task_id
  ) sub
 where bt.id = sub.task_id;

-- Realtime: task_comments + board_tasks (comments_count updates).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_comments'
  ) then
    alter publication supabase_realtime add table public.task_comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'board_tasks'
  ) then
    alter publication supabase_realtime add table public.board_tasks;
  end if;
end $$;

alter table public.task_comments replica identity full;
alter table public.board_tasks replica identity full;
