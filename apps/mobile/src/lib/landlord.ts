import type {
  Lease,
  LeaseFormValues,
  LeaseTenant,
  Property,
  PropertyFormValues,
  Unit,
  UnitFormValues,
} from '@rental/shared';

import { supabase } from '@/lib/supabase';

export type UnitSummary = Unit & { leases: Pick<Lease, 'id' | 'status' | 'rent_amount'>[] };
export type PropertyWithUnits = Property & { units: UnitSummary[] };
export type LeaseWithTenants = Lease & { lease_tenants: LeaseTenant[] };
export type UnitDetail = Unit & {
  properties: Pick<Property, 'id' | 'name'>;
  leases: LeaseWithTenants[];
};

type Result<T> = { data: T; error: { code?: string; message: string } | null };

/** Returns the data or throws, using a friendlier message for known Postgres error codes. */
function unwrap<T>({ data, error }: Result<T>, messages: Record<string, string> = {}): NonNullable<T> {
  if (error) throw new Error((error.code && messages[error.code]) || error.message);
  return data as NonNullable<T>;
}

const UNIQUE_VIOLATION = '23505';

export async function listProperties(): Promise<PropertyWithUnits[]> {
  return unwrap(
    await supabase
      .from('properties')
      .select('*, units(*, leases(id, status, rent_amount))')
      .order('created_at'),
  );
}

export async function getProperty(id: string): Promise<PropertyWithUnits> {
  return unwrap(
    await supabase
      .from('properties')
      .select('*, units(*, leases(id, status, rent_amount))')
      .eq('id', id)
      .order('label', { referencedTable: 'units' })
      .single(),
  );
}

export async function createProperty(landlordId: string, values: PropertyFormValues): Promise<string> {
  const row = unwrap(
    await supabase
      .from('properties')
      .insert({
        landlord_id: landlordId,
        name: values.name,
        address_line1: values.addressLine1,
        address_line2: values.addressLine2,
        city: values.city,
        region: values.region,
        postal_code: values.postalCode,
      })
      .select('id')
      .single(),
  );
  return row.id;
}

export async function createUnit(propertyId: string, values: UnitFormValues): Promise<void> {
  unwrap(
    await supabase.from('units').insert({
      property_id: propertyId,
      label: values.label,
      bedrooms: values.bedrooms,
      default_rent: values.defaultRent,
    }),
    { [UNIQUE_VIOLATION]: `This property already has a unit called ${values.label}` },
  );
}

export async function getUnit(id: string): Promise<UnitDetail> {
  return unwrap(
    await supabase
      .from('units')
      .select('*, properties(id, name), leases(*, lease_tenants(*))')
      .eq('id', id)
      .order('start_date', { referencedTable: 'leases', ascending: false })
      .single(),
  );
}

/** Creates the lease and its invites together; see create_lease() in the migrations. */
export async function createLease(unitId: string, values: LeaseFormValues): Promise<void> {
  unwrap(
    await supabase.rpc('create_lease', {
      p_unit_id: unitId,
      p_start_date: values.startDate,
      p_end_date: values.endDate,
      p_rent_amount: values.rentAmount,
      p_due_day: values.dueDay,
      p_grace_days: values.graceDays,
      p_late_fee: values.lateFee,
      p_tenant_emails: values.tenantEmails,
    }),
    { [UNIQUE_VIOLATION]: 'This unit already has an active lease. End it before starting a new one.' },
  );
}

export async function endLease(leaseId: string): Promise<void> {
  unwrap(await supabase.from('leases').update({ status: 'ended' }).eq('id', leaseId));
}

export async function revokeInvite(leaseId: string, email: string): Promise<void> {
  unwrap(
    await supabase
      .from('lease_tenants')
      .update({ invite_status: 'revoked' })
      .eq('lease_id', leaseId)
      .eq('invite_email', email),
  );
}
