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
do $$
declare
  v_lease uuid;
begin
  v_lease := public.create_lease(
    'aaaaaaaa-0000-0000-0000-000000000002', '2026-11-01', null, 185000, 1::smallint, 5::smallint, 5000,
    array['Ten@Example.com ']
  );
  assert (select invite_email from public.lease_tenants where lease_id = v_lease) = 'ten@example.com',
    'invite emails are normalised';
  begin
    perform public.create_lease(
      'aaaaaaaa-0000-0000-0000-000000000002', '2026-12-01', null, 185000, 1::smallint, 0::smallint, 0,
      array['x@example.com']);
    raise exception 'second active lease allowed on one unit';
  exception when unique_violation then null;
  end;
  -- A landlord cannot accept an invite on the tenant's behalf.
  begin
    update public.lease_tenants set invite_status = 'accepted', tenant_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'landlord accepted an invite';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.lease_tenants set invite_status = 'accepted';
    raise exception 'landlord accepted an invite';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    insert into public.lease_tenants (lease_id, invite_email, tenant_id, invite_status)
      values (v_lease, 'out@example.com', '33333333-3333-3333-3333-333333333333', 'accepted');
    raise exception 'landlord inserted an accepted invite';
  exception when insufficient_privilege then null;
  end;
end $$;
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
-- Tenant can upload a photo into their conversation's folder.
insert into storage.objects (bucket_id, name)
  select 'message-attachments', id || '/sink.jpg' from public.conversations;
do $$ begin
  assert (select participant_names from public.list_conversations()) = array['Lana'], 'tenant sees the landlord';
  assert (select count(*) from storage.objects) = 1, 'tenant sees their attachment';
  assert (select unread_count from public.list_conversations()) = 0, 'own messages are never unread';
end $$;
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
  assert (select count(*) from public.list_conversations()) = 0, 'outsider has an empty inbox';
  assert (select count(*) from storage.objects) = 0, 'outsider cannot see attachments';
  begin
    insert into storage.objects (bucket_id, name)
      values ('message-attachments', (select id from public.conversations limit 1) || '/x.jpg');
    raise exception 'outsider uploaded an attachment';
  exception when insufficient_privilege or not_null_violation then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('message-attachments', 'aaaaaaaa-0000-0000-0000-000000000099/x.jpg');
    raise exception 'outsider uploaded into an unknown conversation';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.profiles) = 1, 'outsider sees only themselves';
  begin
    perform public.create_lease(
      'aaaaaaaa-0000-0000-0000-000000000002', '2027-01-01', null, 100, 1::smallint, 0::smallint, 0,
      array['out@example.com']);
    raise exception 'outsider created a lease on another landlord''s unit';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.messages (conversation_id, sender_id, body)
      values ((select id from public.conversations limit 1), auth.uid(), 'spam');
    raise exception 'outsider posted a message';
  exception when insufficient_privilege or not_null_violation then null;
  end;
end $$;

-- Landlord sees the conversation in their inbox, reads it, and cannot see the outsider.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare
  inbox record;
begin
  select * into strict inbox from public.list_conversations();
  assert inbox.unread_count = 1, 'landlord has one unread message';
  assert inbox.participant_names = array['Theo'], 'landlord sees the tenant in the inbox';
  assert inbox.last_message_body = 'The kitchen sink is leaking', 'inbox shows the latest message';
  assert public.mark_conversation_read(inbox.conversation_id) = 1, 'landlord marks it read';
  assert (select unread_count from public.list_conversations()) = 0, 'nothing unread after reading';
  assert (select body from public.messages) = 'The kitchen sink is leaking', 'landlord reads the message';
  assert (select count(*) from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 0,
    'landlord cannot see unrelated users';
end $$;

-- Landlord revokes the tenant; the tenant loses access.
update public.lease_tenants set invite_status = 'revoked';
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  assert (select count(*) from public.leases) = 0, 'revoked tenant loses the lease';
  assert (select count(*) from public.messages) = 0, 'revoked tenant loses messages';
  assert public.accept_lease_invites() = 0, 'a revoked invite cannot be re-accepted';
end $$;

reset role;
\echo 'RLS checks passed'
