-- Initial schema: profiles, properties, units, leases, rent, payments, messaging.
-- Money is stored in integer cents. Row-level security is on for every table;
-- writes that must be trusted (Stripe state, rent charges, payments) go through
-- the service role from Edge Functions, so authenticated users get no policy for them.

create type public.user_role as enum ('landlord', 'tenant');
create type public.lease_status as enum ('draft', 'active', 'ended');
create type public.invite_status as enum ('pending', 'accepted', 'revoked');
create type public.rent_charge_status as enum ('due', 'paid', 'late', 'waived');
create type public.payment_method as enum ('ach', 'card');
create type public.payment_status as enum ('processing', 'succeeded', 'failed', 'refunded');

-- Tables ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null default '',
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.landlord_accounts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text unique,
  payouts_enabled boolean not null default false
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text not null,
  postal_code text not null,
  country text not null default 'US',
  created_at timestamptz not null default now()
);
create index properties_landlord_id_idx on public.properties (landlord_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  label text not null,
  bedrooms smallint check (bedrooms >= 0),
  default_rent integer check (default_rent >= 0),
  unique (property_id, label)
);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete restrict,
  start_date date not null,
  end_date date check (end_date is null or end_date > start_date),
  rent_amount integer not null check (rent_amount > 0),
  due_day smallint not null default 1 check (due_day between 1 and 31),
  late_fee integer not null default 0 check (late_fee >= 0),
  grace_days smallint not null default 0 check (grace_days >= 0),
  status public.lease_status not null default 'draft',
  created_at timestamptz not null default now()
);
create index leases_unit_id_idx on public.leases (unit_id);
-- One active lease per unit at a time.
create unique index leases_one_active_per_unit on public.leases (unit_id) where status = 'active';

create table public.lease_tenants (
  lease_id uuid not null references public.leases (id) on delete cascade,
  invite_email text not null,
  tenant_id uuid references public.profiles (id) on delete set null,
  invite_status public.invite_status not null default 'pending',
  primary key (lease_id, invite_email)
);
create index lease_tenants_tenant_id_idx on public.lease_tenants (tenant_id);

create table public.rent_charges (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  period date not null, -- first day of the month the charge covers
  amount_due integer not null check (amount_due >= 0),
  due_date date not null,
  status public.rent_charge_status not null default 'due',
  unique (lease_id, period)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  rent_charge_id uuid not null references public.rent_charges (id) on delete restrict,
  payer_id uuid not null references public.profiles (id),
  amount integer not null check (amount > 0),
  method public.payment_method not null,
  stripe_payment_intent_id text unique,
  status public.payment_status not null default 'processing',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_rent_charge_id_idx on public.payments (rent_charge_id);

create table public.autopay_settings (
  lease_id uuid not null references public.leases (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  stripe_payment_method_id text not null,
  enabled boolean not null default true,
  primary key (lease_id, tenant_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null unique references public.leases (id) on delete cascade
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null default '',
  attachment_path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (body <> '' or attachment_path is not null)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);

-- Access helpers ---------------------------------------------------------------
-- security definer so policies can look across tables without recursing into RLS.

create function public.is_landlord_of_lease(p_lease_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.leases l
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where l.id = p_lease_id and p.landlord_id = auth.uid()
  );
$$;

create function public.is_tenant_of_lease(p_lease_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lease_tenants lt
    where lt.lease_id = p_lease_id
      and lt.tenant_id = auth.uid()
      and lt.invite_status = 'accepted'
  );
$$;

create function public.is_party_to_lease(p_lease_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_landlord_of_lease(p_lease_id) or public.is_tenant_of_lease(p_lease_id);
$$;

create function public.is_landlord()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'landlord');
$$;

create function public.owns_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.properties where id = p_property_id and landlord_id = auth.uid());
$$;

create function public.owns_unit(p_unit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.units u join public.properties p on p.id = u.property_id
    where u.id = p_unit_id and p.landlord_id = auth.uid()
  );
$$;

create function public.is_tenant_of_unit(p_unit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leases l
    where l.unit_id = p_unit_id and public.is_tenant_of_lease(l.id)
  );
$$;

create function public.is_tenant_of_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.units u
    where u.property_id = p_property_id and public.is_tenant_of_unit(u.id)
  );
$$;

-- True when the current user and p_profile_id are landlord and accepted tenant on the same lease.
create function public.shares_lease_with(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lease_tenants lt
    join public.leases l on l.id = lt.lease_id
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where lt.invite_status = 'accepted'
      and (
        (p.landlord_id = auth.uid() and lt.tenant_id = p_profile_id)
        or (lt.tenant_id = auth.uid() and p.landlord_id = p_profile_id)
      )
  );
$$;

-- Triggers ---------------------------------------------------------------------

-- Create a profile when someone signs up. Role and name come from sign-up metadata.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'tenant'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  if (new.raw_user_meta_data ->> 'role') = 'landlord' then
    insert into public.landlord_accounts (profile_id) values (new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Every lease gets exactly one conversation between landlord and tenants.
create function public.handle_new_lease()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversations (lease_id) values (new.id);
  return new;
end;
$$;

create trigger on_lease_created
  after insert on public.leases
  for each row execute function public.handle_new_lease();

-- Tenants accept an invite sent to the email they signed up with.
create function public.accept_lease_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  accepted integer;
begin
  update public.lease_tenants lt
  set tenant_id = auth.uid(), invite_status = 'accepted'
  from public.profiles pr
  where pr.id = auth.uid()
    and pr.role = 'tenant'
    and lower(lt.invite_email) = lower(pr.email)
    and lt.invite_status = 'pending';
  get diagnostics accepted = row_count;
  return accepted;
end;
$$;

-- Row-level security -------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.landlord_accounts enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.leases enable row level security;
alter table public.lease_tenants enable row level security;
alter table public.rent_charges enable row level security;
alter table public.payments enable row level security;
alter table public.autopay_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- profiles: see yourself and anyone you share a lease with; edit only your name and phone.
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "read lease counterparts" on public.profiles
  for select to authenticated using (public.shares_lease_with(id));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- landlord_accounts: read-only for the landlord; Stripe webhooks update it.
create policy "landlord reads own account" on public.landlord_accounts
  for select to authenticated using (profile_id = (select auth.uid()));

-- properties
create policy "landlord manages own properties" on public.properties
  for all to authenticated
  using (landlord_id = (select auth.uid()))
  with check (landlord_id = (select auth.uid()) and public.is_landlord());
create policy "tenant reads leased property" on public.properties
  for select to authenticated using (public.is_tenant_of_property(id));

-- units
create policy "landlord manages units" on public.units
  for all to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
create policy "tenant reads leased unit" on public.units
  for select to authenticated using (public.is_tenant_of_unit(id));

-- leases
create policy "landlord manages leases" on public.leases
  for all to authenticated
  using (public.is_landlord_of_lease(id))
  with check (public.owns_unit(unit_id));
create policy "tenant reads own lease" on public.leases
  for select to authenticated using (public.is_tenant_of_lease(id));

-- lease_tenants: landlords invite; tenants see their own row and accept through accept_lease_invites().
create policy "landlord manages invites" on public.lease_tenants
  for all to authenticated
  using (public.is_landlord_of_lease(lease_id))
  with check (public.is_landlord_of_lease(lease_id));
create policy "tenant reads own invite" on public.lease_tenants
  for select to authenticated using (tenant_id = (select auth.uid()));

-- rent_charges: created by a scheduled function; landlords may waive.
create policy "parties read rent charges" on public.rent_charges
  for select to authenticated using (public.is_party_to_lease(lease_id));
create policy "landlord updates rent charges" on public.rent_charges
  for update to authenticated
  using (public.is_landlord_of_lease(lease_id))
  with check (public.is_landlord_of_lease(lease_id));
revoke update on public.rent_charges from authenticated;
grant update (status) on public.rent_charges to authenticated;

-- payments: written only by Stripe webhooks.
create policy "parties read payments" on public.payments
  for select to authenticated using (
    payer_id = (select auth.uid())
    or exists (
      select 1 from public.rent_charges rc
      where rc.id = rent_charge_id and public.is_landlord_of_lease(rc.lease_id)
    )
  );

-- autopay_settings: the tenant reads and switches it off; saving a card goes through Stripe.
create policy "tenant reads own autopay" on public.autopay_settings
  for select to authenticated using (tenant_id = (select auth.uid()));
create policy "tenant updates own autopay" on public.autopay_settings
  for update to authenticated
  using (tenant_id = (select auth.uid()))
  with check (tenant_id = (select auth.uid()));
revoke update on public.autopay_settings from authenticated;
grant update (enabled) on public.autopay_settings to authenticated;

-- conversations and messages
create policy "parties read conversation" on public.conversations
  for select to authenticated using (public.is_party_to_lease(lease_id));

create policy "parties read messages" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id and public.is_party_to_lease(c.lease_id))
  );
create policy "parties send messages" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.conversations c where c.id = conversation_id and public.is_party_to_lease(c.lease_id))
  );
create policy "recipients mark messages read" on public.messages
  for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (select 1 from public.conversations c where c.id = conversation_id and public.is_party_to_lease(c.lease_id))
  );
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- Realtime: stream new messages to the app.
alter publication supabase_realtime add table public.messages;

-- Storage: message attachments live at <conversation_id>/<file name>.
insert into storage.buckets (id, name, public) values ('message-attachments', 'message-attachments', false);

create policy "parties read attachments" on storage.objects
  for select to authenticated using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1] and public.is_party_to_lease(c.lease_id)
    )
  );
create policy "parties upload attachments" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1] and public.is_party_to_lease(c.lease_id)
    )
  );
