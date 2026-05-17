-- Public-safe invite preview by token (token is the secret). Used before authentication.

create or replace function public.get_workspace_invite_preview(p_token text)
returns table (
  invite_id uuid,
  invited_email text,
  invite_role text,
  invite_status text,
  expires_at timestamptz,
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  workspace_icon text,
  inviter_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_ws public.workspaces%rowtype;
  v_inviter_name text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  select wi.*
    into v_invite
    from public.workspace_invites wi
   where wi.token = trim(p_token);

  if not found then
    return;
  end if;

  if v_invite.status = 'pending' and v_invite.expires_at < now() then
    update public.workspace_invites wi
       set status = 'expired'
     where wi.id = v_invite.id;
    v_invite.status := 'expired';
  end if;

  select w.*
    into v_ws
    from public.workspaces w
   where w.id = v_invite.workspace_id;

  select coalesce(nullif(trim(p.display_name), ''), 'A teammate')
    into v_inviter_name
    from public.profiles p
   where p.id = v_invite.invited_by;

  return query
    select
      v_invite.id,
      v_invite.invited_email,
      v_invite.role,
      v_invite.status,
      v_invite.expires_at,
      v_ws.id,
      v_ws.name,
      v_ws.slug,
      v_ws.icon,
      v_inviter_name;
end;
$$;

grant execute on function public.get_workspace_invite_preview(text) to anon, authenticated;
