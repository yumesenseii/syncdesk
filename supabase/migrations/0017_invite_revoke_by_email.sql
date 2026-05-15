-- Clear a blocking pending invite by email (visible or not) so managers can re-invite.

create or replace function public.revoke_pending_workspace_invite_by_email(
  p_workspace_id uuid,
  p_email text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not (
    public.is_workspace_member(p_workspace_id)
    or public.is_workspace_owner(p_workspace_id)
    or public.can_manage_workspace_members(p_workspace_id)
  ) then
    raise exception 'Not allowed to manage invites for this workspace';
  end if;

  update public.workspace_invites wi
  set status = 'revoked'
  where wi.workspace_id = p_workspace_id
    and wi.status = 'pending'
    and lower(trim(wi.invited_email)) = lower(trim(p_email));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.revoke_pending_workspace_invite_by_email(uuid, text) to authenticated;
