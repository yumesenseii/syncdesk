-- SyncDesk: workspaces, boards, tasks, team, notifications, profiles
-- Apply in Supabase → SQL Editor (service role) or via Supabase CLI.
-- After apply: Database → Replication → enable supabase_realtime for:
--   workspaces, boards, board_tasks, team_members, notifications

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,  
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,  
  name text not null,
  initials text not null,
  color text not null,
  updated_at timestamptz not null default now()
);

create index if not exists team_members_user_id_idx on public.team_members (user_id);

alter table public.team_members enable row level security;

create policy "team_members_all_own" on public.team_members for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '📂',
  expanded boolean not null default true,
  member_ids text[] not null default '{}',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on public.workspaces (owner_id);

alter table public.workspaces enable row level security;

create policy "workspaces_all_own" on public.workspaces for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  settings jsonb,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists boards_created_by_idx on public.boards (created_by);
create index if not exists boards_workspace_id_idx on public.boards (workspace_id);

alter table public.boards enable row level security;

create policy "boards_all_own" 
on public.boards
for all
using (created_by = auth.uid())
with check (created_by = auth.uid());

create table if not exists public.board_tasks (
 id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  description text not null default '',
  column_id text not null,
  tags text[] not null default '{}',
  priority text not null,
  due text not null default '',
  overdue boolean not null default false,
  comments_count int not null default 0,
  attachments_count int not null default 0,
  assignees jsonb not null default '[]'::jsonb,
  progress int not null default 0,
  updated_at timestamptz not null default now(),
  constraint board_tasks_column_ck check (column_id in ('todo', 'in_progress', 'review', 'completed'))
);

create index if not exists board_tasks_user_id_idx on public.board_tasks (user_id);
create index if not exists board_tasks_board_id_idx on public.board_tasks (board_id);

alter table public.board_tasks enable row level security;

create policy "board_tasks_all_own" on public.board_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

alter table public.notifications enable row level security;

create policy "notifications_all_own" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
