-- Fix: pending invites exist but are invisible when invited_by != current user (RLS hid rows
-- while the unique index still blocked duplicate inserts).

-- Expire stale pending invites so old rows don't block re-invites forever.
create or replace function public.expire_stale_workspace_invites(p_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Not a workspace member';
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

grant execute on function public.expire_stale_workspace_invites(uuid) to authenticated;

-- Replace inviter-only policy with workspace-member visibility.
drop policy if exists "workspace_invites_owner_all" on public.workspace_invites;
drop policy if exists "workspace_invites_recipient_select" on public.workspace_invites;

create policy "workspace_invites_select_member"
  on public.workspace_invites
  for select
  using (
    public.is_workspace_member(workspace_id)
    or public.is_workspace_owner(workspace_id)
    or (
      auth.uid() is not null
      and lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email')::text, ''))
    )
  );

create policy "workspace_invites_insert_manager"
  on public.workspace_invites
  for insert
  to authenticated
  with check (
    public.can_manage_workspace_members(workspace_id)
    and invited_by = auth.uid()
  );

create policy "workspace_invites_update_manager"
  on public.workspace_invites
  for update
  to authenticated
  using (public.can_manage_workspace_members(workspace_id))
  with check (public.can_manage_workspace_members(workspace_id));

create policy "workspace_invites_delete_manager"
  on public.workspace_invites
  for delete
  to authenticated
  using (public.can_manage_workspace_members(workspace_id));
