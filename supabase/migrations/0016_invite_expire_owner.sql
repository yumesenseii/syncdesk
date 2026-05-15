-- Allow workspace owners to expire stale invites (not only workspace_members row).

create or replace function public.expire_stale_workspace_invites(p_workspace_id uuid)
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
  set status = 'expired'
  where wi.workspace_id = p_workspace_id
    and wi.status = 'pending'
    and wi.expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Backfill owners missing from workspace_members (legacy workspaces).
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
  from public.workspaces w
 where not exists (
   select 1
     from public.workspace_members wm
    where wm.workspace_id = w.id
      and wm.user_id = w.owner_id
 )
on conflict (workspace_id, user_id) do nothing;
