import type { Cents } from './money.ts';
import type { Role } from './roles.ts';

// Row shapes for the tables in supabase/migrations. Keep in sync by hand
// until we generate them with `supabase gen types typescript`.

export type LeaseStatus = 'draft' | 'active' | 'ended';
export type InviteStatus = 'pending' | 'accepted' | 'revoked';
export type RentChargeStatus = 'due' | 'paid' | 'late' | 'waived';
export type PaymentMethod = 'ach' | 'card';
export type PaymentStatus = 'processing' | 'succeeded' | 'failed' | 'refunded';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface LandlordAccount {
  profile_id: string;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
}

export interface Property {
  id: string;
  landlord_id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  created_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  label: string;
  bedrooms: number | null;
  default_rent: Cents | null;
}

export interface Lease {
  id: string;
  unit_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount: Cents;
  due_day: number;
  late_fee: Cents;
  grace_days: number;
  status: LeaseStatus;
}

export interface LeaseTenant {
  lease_id: string;
  tenant_id: string | null;
  invite_email: string;
  invite_status: InviteStatus;
}

export interface RentCharge {
  id: string;
  lease_id: string;
  period: string;
  amount_due: Cents;
  due_date: string;
  status: RentChargeStatus;
}

export interface Payment {
  id: string;
  rent_charge_id: string;
  payer_id: string;
  amount: Cents;
  method: PaymentMethod;
  stripe_payment_intent_id: string | null;
  status: PaymentStatus;
  paid_at: string | null;
}

export interface Conversation {
  id: string;
  lease_id: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_path: string | null;
  read_at: string | null;
  created_at: string;
}
