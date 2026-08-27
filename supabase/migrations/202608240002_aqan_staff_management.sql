-- Staff management for AQAN owners and admins.

create index if not exists aqan_crm_leads_created_by_idx
  on public.aqan_crm_leads (created_by) where created_by is not null;

create policy aqan_profiles_admin_select on public.aqan_profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.aqan_memberships membership
      where membership.user_id = public.aqan_profiles.id
        and private.aqan_has_role(membership.organization_id, array['owner','admin'])
    )
  );

create or replace function public.aqan_set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  caller_role text;
  current_role text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_role not in ('admin', 'sales', 'service', 'viewer') then raise exception 'Unsupported role'; end if;
  select organization_id, role into target_organization_id, caller_role
  from public.aqan_memberships where user_id = (select auth.uid()) order by created_at limit 1;
  if caller_role not in ('owner', 'admin') then raise exception 'Only owners and admins can manage staff'; end if;
  select role into current_role from public.aqan_memberships
  where organization_id = target_organization_id and user_id = p_user_id;
  if current_role is null then raise exception 'Staff member is not in this workspace'; end if;
  if current_role = 'owner' and caller_role <> 'owner' then raise exception 'Only an owner can manage owner access'; end if;
  update public.aqan_memberships set role = p_role
  where organization_id = target_organization_id and user_id = p_user_id;
end;
$$;
revoke all on function public.aqan_set_member_role(uuid, text) from public, anon, authenticated;
grant execute on function public.aqan_set_member_role(uuid, text) to authenticated;
