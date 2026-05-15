-- SyncDesk: workspace slug architecture
-- Apply in Supabase → SQL Editor (service role) or via Supabase CLI.
--
-- Decouples the stable workspace primary key (`id`) from the URL-facing slug.
-- After this migration the app uses `workspace.id` (UUID-shaped text) for every
-- relational join and `workspace.slug` for human-readable URLs only.

alter table public.workspaces
  add column if not exists slug text;

-- Backfill any existing rows so the slug is never null.
update public.workspaces
   set slug = id
 where slug is null;

alter table public.workspaces
  alter column slug set not null;

-- Each owner's workspace slugs must be unique so URL routing is deterministic.
create unique index if not exists workspaces_owner_slug_uq
  on public.workspaces (owner_id, lower(slug));

-- Helper RPC for looking up a workspace by slug (the client could also do
-- the lookup directly; the function exists for typed convenience and to keep
-- the round-trip in the SECURITY INVOKER context that respects RLS).
create or replace function public.workspace_by_slug(p_slug text)
returns table (
  id text,
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
    and w.owner_id = auth.uid()
$$;

grant execute on function public.workspace_by_slug(text) to authenticated;

-- Upgrade accept_workspace_invite to also return the workspace slug so the
-- client can redirect to the new slug-based URL after acceptance. We drop
-- first because the return signature is part of the function identity, then
-- recreate with the same body as in 0002 plus the slug column.
drop function if exists public.accept_workspace_invite(text);

create or replace function public.accept_workspace_invite(p_token text)
returns table (
  workspace_id text,
  workspace_slug text,
  workspace_name text,
  team_member_id text
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
  v_team_id text;
  v_existing text;
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

  select id into v_existing
    from public.team_members
    where user_id = v_invite.invited_by
      and lower(email) = v_user_email
    limit 1;

  if v_existing is not null then
    v_team_id := v_existing;
    update public.team_members
      set name = v_full_name,
          initials = v_initials,
          updated_at = now()
      where id = v_team_id;
  else
    v_team_id := 'tm_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.team_members (id, user_id, name, initials, color, email, updated_at)
      values (v_team_id, v_invite.invited_by, v_full_name, v_initials, v_color, v_invite.invited_email, now());
  end if;

  update public.workspaces
    set member_ids = (
          select array(select distinct unnest(coalesce(member_ids, '{}'::text[]) || array[v_team_id]))
        ),
        updated_at = now()
    where id = v_invite.workspace_id;

  update public.workspace_invites
    set status = 'accepted',
        accepted_at = now(),
        accepted_by = v_user_id
    where id = v_invite.id;

  return query
    select w.id, w.slug, w.name, v_team_id
    from public.workspaces w
    where w.id = v_invite.workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;
