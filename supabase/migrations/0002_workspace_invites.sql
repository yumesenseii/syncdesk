-- SyncDesk: workspace email invitations
-- Apply in Supabase → SQL Editor (service role) or via Supabase CLI.
-- After apply: Database → Replication → enable supabase_realtime for `workspace_invites`.

create extension if not exists "pgcrypto";

-- Optional email column so the inviter can detect existing teammates by email.
alter table public.team_members
  add column if not exists email text;

drop index if exists team_members_user_email_uq;

create unique index if not exists team_members_user_email_uq
  on public.team_members (user_id, lower(email))
  where email is not null;

-- ---------------------------------------------------------------------------
-- workspace_invites (UUID workspace_id; case-insensitive email via expression)
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  token text not null unique,
  message text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

-- Legacy installs may still have the removed generated column.
alter table public.workspace_invites
  drop column if exists invited_email_lower;

-- Ensure workspace_id is uuid and references workspaces(id) (idempotent type fix).
do $$
begin
  if exists (
    select 1
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'workspace_invites'
       and c.column_name = 'workspace_id'
       and c.data_type <> 'uuid'
  ) then
    alter table public.workspace_invites
      alter column workspace_id type uuid using workspace_id::uuid;
  end if;
exception
  when others then
    raise notice 'workspace_invites.workspace_id type alignment skipped: %', sqlerrm;
end;
$$;

-- Pending invite uniqueness per workspace + normalized email.
drop index if exists workspace_invites_pending_uq;

create unique index if not exists workspace_invites_pending_uq
  on public.workspace_invites (workspace_id, lower(invited_email))
  where status = 'pending';

create index if not exists workspace_invites_workspace_idx
  on public.workspace_invites (workspace_id);

create index if not exists workspace_invites_invited_by_idx
  on public.workspace_invites (invited_by);

create index if not exists workspace_invites_email_lower_idx
  on public.workspace_invites (lower(invited_email));

alter table public.workspace_invites enable row level security;

drop policy if exists "workspace_invites_owner_all" on public.workspace_invites;

-- The inviter (workspace owner) can fully manage their invites.
create policy "workspace_invites_owner_all"
  on public.workspace_invites
  for all
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());

drop policy if exists "workspace_invites_recipient_select" on public.workspace_invites;

-- An authenticated invitee may read an invite addressed to them.
create policy "workspace_invites_recipient_select"
  on public.workspace_invites
  for select
  using (
    auth.uid() is not null
    and lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email')::text, ''))
  );

-- Accept-by-token RPC: returns the workspace info and adds the invitee to the
-- inviter's team_members + workspace.member_ids. Runs as SECURITY DEFINER so a
-- newly-signed-up user can accept without RLS blocking the cross-tenant write.
drop function if exists public.accept_workspace_invite(text);

create or replace function public.accept_workspace_invite(p_token text)
returns table (
  workspace_id uuid,
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

  select * into v_invite from public.workspace_invites where token = p_token;
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
    update public.workspace_invites set status = 'expired' where id = v_invite.id;
    raise exception 'This invitation has expired.';
  end if;

  if v_user_email = '' or v_user_email <> lower(v_invite.invited_email) then
    raise exception 'Sign in with % to accept this invitation.', v_invite.invited_email;
  end if;

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

  -- Reuse an existing team_members row owned by the inviter if their email matches.
  select tm.id into v_existing
    from public.team_members tm
    where tm.user_id = v_invite.invited_by
      and lower(tm.email) = v_user_email
    limit 1;

  if v_existing is not null then
    v_team_id := v_existing;
    update public.team_members
      set name = v_full_name,
          initials = v_initials,
          updated_at = now()
      where id = v_team_id;
  else
    v_team_id := gen_random_uuid();
    insert into public.team_members (id, user_id, name, initials, color, email, updated_at)
      values (v_team_id, v_invite.invited_by, v_full_name, v_initials, v_color, v_invite.invited_email, now());
  end if;

  update public.workspaces w
    set member_ids = (
          select array(
            select distinct unnest(
              coalesce(w.member_ids, '{}'::text[]) || array[v_team_id::text]
            )
          )
        ),
        updated_at = now()
    where w.id = v_invite.workspace_id;

  update public.workspace_invites
    set status = 'accepted',
        accepted_at = now(),
        accepted_by = v_user_id
    where id = v_invite.id;

  return query
    select w.id, w.name, v_team_id
    from public.workspaces w
    where w.id = v_invite.workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;

-- Helper view for the inviter to see invite counts per workspace.
create or replace view public.workspace_invite_counts as
  select wi.workspace_id,
         count(*) filter (where wi.status = 'pending') as pending,
         count(*) filter (where wi.status = 'accepted') as accepted
    from public.workspace_invites wi
   group by wi.workspace_id;

grant select on public.workspace_invite_counts to authenticated;
