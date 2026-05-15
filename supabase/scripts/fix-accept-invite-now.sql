-- Paste into Supabase SQL Editor → Run
-- Fixes: workspace_id ambiguous + COALESCE text[]/uuid[] on member_ids

drop function if exists public.accept_workspace_invite(text);

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

  select wi.* into v_invite from public.workspace_invites wi where wi.token = p_token;
  if not found then raise exception 'This invitation no longer exists.'; end if;
  if v_invite.status = 'accepted' then raise exception 'This invitation has already been accepted.'; end if;
  if v_invite.status = 'revoked' then raise exception 'This invitation was revoked by the workspace owner.'; end if;
  if v_invite.status = 'expired' or v_invite.expires_at < now() then
    update public.workspace_invites wi set status = 'expired' where wi.id = v_invite.id;
    raise exception 'This invitation has expired.';
  end if;
  if v_user_email = '' or v_user_email <> lower(v_invite.invited_email) then
    raise exception 'Sign in with % to accept this invitation.', v_invite.invited_email;
  end if;

  v_target_workspace_id := v_invite.workspace_id;
  v_member_role := case when v_invite.role in ('admin', 'viewer', 'member') then v_invite.role else 'member' end;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_target_workspace_id, v_user_id, v_member_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  select w.name, w.slug into v_ws_name, v_ws_slug from public.workspaces w where w.id = v_target_workspace_id;

  select coalesce(p.display_name, split_part(coalesce((auth.jwt() ->> 'email')::text, ''), '@', 1), 'Member')
    into v_full_name from public.profiles p where p.id = v_user_id;
  if v_full_name is null or length(v_full_name) = 0 then
    v_full_name := split_part(v_invite.invited_email, '@', 1);
  end if;

  v_initials := upper(substring(regexp_replace(v_full_name, '[^A-Za-z]', '', 'g'), 1, 2));
  if length(v_initials) = 0 then v_initials := upper(substring(v_invite.invited_email, 1, 2)); end if;
  v_color := v_palette[((abs(hashtext(v_user_email)) % array_length(v_palette, 1)) + 1)];

  select tm.id into v_existing from public.team_members tm
   where tm.user_id = v_invite.invited_by and lower(tm.email) = v_user_email limit 1;

  if v_existing is not null then
    v_team_id := v_existing;
    update public.team_members set name = v_full_name, initials = v_initials, updated_at = now() where id = v_team_id;
  else
    v_team_id := gen_random_uuid();
    insert into public.team_members (id, user_id, name, initials, color, email, updated_at)
    values (v_team_id, v_invite.invited_by, v_full_name, v_initials, v_color, v_invite.invited_email, now());
  end if;

  update public.workspace_invites
     set status = 'accepted', accepted_at = now(), accepted_by = v_user_id
   where id = v_invite.id;

  return query
    select w.id, w.slug, w.name, v_team_id from public.workspaces w where w.id = v_target_workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;
