-- Fix: accept_workspace_invite RETURNS TABLE (workspace_id ...) shadows table columns
-- and causes "column reference workspace_id is ambiguous" on INSERT … ON CONFLICT.
-- Also log member_joined / member_invited activity server-side (realtime-safe).

-- ---------------------------------------------------------------------------
-- Definer helper: insert activity without RLS member check (triggers / RPC)
-- ---------------------------------------------------------------------------
create or replace function public.insert_activity_event_definer(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
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
    null,
    null,
    p_actor_user_id,
    p_event_type,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_activity_event_definer(uuid, uuid, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Activity when a pending invite row is created
-- ---------------------------------------------------------------------------
create or replace function public.trg_workspace_invite_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws_name text;
  v_ws_slug text;
begin
  if NEW.status is distinct from 'pending' then
    return NEW;
  end if;

  select w.name, w.slug
    into v_ws_name, v_ws_slug
    from public.workspaces w
   where w.id = NEW.workspace_id;

  perform public.insert_activity_event_definer(
    NEW.workspace_id,
    NEW.invited_by,
    'member_invited',
    format('invited %s', NEW.invited_email),
    jsonb_build_object(
      'invited_email', NEW.invited_email,
      'workspace_name', v_ws_name,
      'workspace_slug', v_ws_slug
    )
  );

  return NEW;
end;
$$;

drop trigger if exists workspace_invites_activity_sent on public.workspace_invites;

create trigger workspace_invites_activity_sent
  after insert on public.workspace_invites
  for each row
  execute function public.trg_workspace_invite_activity();

-- ---------------------------------------------------------------------------
-- accept_workspace_invite (qualified columns + member_joined activity)
-- ---------------------------------------------------------------------------
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

  select wi.*
    into v_invite
    from public.workspace_invites wi
   where wi.token = p_token;

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
    update public.workspace_invites wi
       set status = 'expired'
     where wi.id = v_invite.id;
    raise exception 'This invitation has expired.';
  end if;

  if v_user_email = '' or v_user_email <> lower(v_invite.invited_email) then
    raise exception 'Sign in with % to accept this invitation.', v_invite.invited_email;
  end if;

  v_target_workspace_id := v_invite.workspace_id;

  v_member_role := case
    when v_invite.role in ('admin', 'viewer', 'member') then v_invite.role
    else 'member'
  end;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_target_workspace_id, v_user_id, v_member_role)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;

  select w.name, w.slug
    into v_ws_name, v_ws_slug
    from public.workspaces w
   where w.id = v_target_workspace_id;

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

  select tm.id
    into v_existing
    from public.team_members tm
   where tm.user_id = v_invite.invited_by
     and lower(tm.email) = v_user_email
   limit 1;

  if v_existing is not null then
    v_team_id := v_existing;
    update public.team_members tm
       set name = v_full_name,
           initials = v_initials,
           updated_at = now()
     where tm.id = v_team_id;
  else
    v_team_id := gen_random_uuid();
    insert into public.team_members (id, user_id, name, initials, color, email, updated_at)
    values (v_team_id, v_invite.invited_by, v_full_name, v_initials, v_color, v_invite.invited_email, now());
  end if;

  update public.workspace_invites wi
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = v_user_id
   where wi.id = v_invite.id;

  begin
    perform public.insert_activity_event_definer(
      v_target_workspace_id,
      v_user_id,
      'member_joined',
      format('%s joined %s', v_invite.invited_email, coalesce(v_ws_name, 'workspace')),
      jsonb_build_object(
        'member_email', v_invite.invited_email,
        'workspace_name', v_ws_name,
        'workspace_slug', v_ws_slug
      )
    );
  exception
    when undefined_function then
      null;
  end;

  return query
    select w.id, w.slug, w.name, v_team_id
      from public.workspaces w
     where w.id = v_target_workspace_id;
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;
