-- Landlords may invite and revoke, but never accept on a tenant's behalf: before this,
-- the "for all" policy let a landlord set tenant_id and invite_status directly.

drop policy "landlord manages invites" on public.lease_tenants;

create policy "landlord reads invites" on public.lease_tenants
  for select to authenticated using (public.is_landlord_of_lease(lease_id));
create policy "landlord sends invites" on public.lease_tenants
  for insert to authenticated with check (
    public.is_landlord_of_lease(lease_id) and tenant_id is null and invite_status = 'pending'
  );
create policy "landlord revokes invites" on public.lease_tenants
  for update to authenticated
  using (public.is_landlord_of_lease(lease_id))
  with check (public.is_landlord_of_lease(lease_id) and invite_status = 'revoked');
create policy "landlord deletes pending invites" on public.lease_tenants
  for delete to authenticated using (public.is_landlord_of_lease(lease_id) and invite_status = 'pending');

revoke insert, update on public.lease_tenants from authenticated;
grant insert (lease_id, invite_email) on public.lease_tenants to authenticated;
grant update (invite_status) on public.lease_tenants to authenticated;

alter table public.lease_tenants
  add constraint lease_tenants_invite_email_format check (invite_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Creates an active lease and its tenant invites in one transaction.
-- security invoker: the caller's row-level security applies to every insert.
create function public.create_lease(
  p_unit_id uuid,
  p_start_date date,
  p_end_date date,
  p_rent_amount integer,
  p_due_day smallint,
  p_grace_days smallint,
  p_late_fee integer,
  p_tenant_emails text[]
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_lease_id uuid;
  v_email text;
begin
  if coalesce(array_length(p_tenant_emails, 1), 0) = 0 then
    raise exception 'A lease needs at least one tenant email' using errcode = '22023';
  end if;

  -- The id is generated up front because RETURNING would need the select policy to see
  -- the new row, which is_landlord_of_lease() cannot until the statement completes.
  v_lease_id := gen_random_uuid();
  insert into public.leases (id, unit_id, start_date, end_date, rent_amount, due_day, grace_days, late_fee, status)
  values (v_lease_id, p_unit_id, p_start_date, p_end_date, p_rent_amount, p_due_day, p_grace_days, p_late_fee, 'active');

  foreach v_email in array p_tenant_emails loop
    insert into public.lease_tenants (lease_id, invite_email)
    values (v_lease_id, lower(trim(v_email)))
    on conflict do nothing;
  end loop;

  return v_lease_id;
end;
$$;
