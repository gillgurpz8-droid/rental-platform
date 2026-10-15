-- Row-level security checks: a landlord, their tenant, and an outsider.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'land@example.com', '{"role":"landlord","full_name":"Lana"}'),
  ('22222222-2222-2222-2222-222222222222', 'Ten@example.com', '{"role":"tenant","full_name":"Theo"}'),
  ('33333333-3333-3333-3333-333333333333', 'out@example.com', '{"role":"tenant","full_name":"Otto"}');

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'sign-up creates profiles';
  assert (select count(*) from public.landlord_accounts) = 1, 'only landlords get a landlord account';
end $$;

set role authenticated;

-- Landlord sets up a property, unit, active lease and invite.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.properties (id, landlord_id, name, address_line1, city, region, postal_code)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Elm St', '1 Elm St', 'Austin', 'TX', '78701');
insert into public.units (id, property_id, label, default_rent)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Apt 1', 185000);
insert into public.leases (id, unit_id, start_date, rent_amount, status)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', '2026-11-01', 185000, 'active');
insert into public.lease_tenants (lease_id, invite_email)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'ten@example.com');
do $$ begin
  assert (select count(*) from public.conversations) = 1, 'a lease gets a conversation';
  assert (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 0,
    'landlord cannot see a tenant before they accept';
end $$;

-- Tenant accepts the invite (email match ignores case) and messages the landlord.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from public.leases) = 0, 'tenant cannot see the lease before accepting';
  assert public.accept_lease_invites() = 1, 'invite accepted';
  assert (select count(*) from public.leases) = 1, 'tenant sees their lease';
  assert (select count(*) from public.properties) = 1, 'tenant sees the property';
  assert (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Lana',
    'tenant sees their landlord';
end $$;
insert into public.messages (conversation_id, sender_id, body)
  select id, '22222222-2222-2222-2222-222222222222', 'The kitchen sink is leaking' from public.conversations;
do $$ begin
  begin
    update public.profiles set role = 'landlord' where id = auth.uid();
    raise exception 'tenant changed their own role';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.properties (landlord_id, name, address_line1, city, region, postal_code)
      values (auth.uid(), 'x', 'x', 'x', 'x', 'x');
    raise exception 'tenant created a property';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Outsider sees nothing and cannot post into the conversation.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin
  assert (select count(*) from public.leases) = 0, 'outsider sees no leases';
  assert (select count(*) from public.properties) = 0, 'outsider sees no properties';
  assert (select count(*) from public.messages) = 0, 'outsider sees no messages';
  assert (select count(*) from public.profiles) = 1, 'outsider sees only themselves';
  begin
    insert into public.messages (conversation_id, sender_id, body)
      values ((select id from public.conversations limit 1), auth.uid(), 'spam');
    raise exception 'outsider posted a message';
  exception when insufficient_privilege or not_null_violation then null;
  end;
end $$;

-- Landlord reads and marks the message read, and cannot see the outsider.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.messages set read_at = now();
do $$ begin
  assert (select body from public.messages) = 'The kitchen sink is leaking', 'landlord reads the message';
  assert (select count(*) from public.messages where read_at is not null) = 1, 'landlord marks it read';
  assert (select count(*) from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 0,
    'landlord cannot see unrelated users';
end $$;

reset role;
\echo 'RLS checks passed'
