-- Inbox: one row per conversation the caller can see, with the latest message and
-- how many messages from others are still unread. security invoker, so the caller's
-- row-level security decides which conversations, messages and names come back.
create function public.list_conversations()
returns table (
  conversation_id uuid,
  lease_id uuid,
  lease_status public.lease_status,
  property_name text,
  unit_label text,
  participant_names text[],
  last_message_body text,
  last_message_has_attachment boolean,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count integer
)
language sql stable security invoker set search_path = '' as $$
  select
    c.id,
    l.id,
    l.status,
    p.name,
    u.label,
    -- Everyone on the lease except the caller, whose names the caller may read.
    coalesce(
      (select array_agg(pr.full_name order by pr.full_name)
       from public.profiles pr
       where pr.id <> auth.uid()
         and (pr.id = p.landlord_id
              or pr.id in (select lt.tenant_id from public.lease_tenants lt
                           where lt.lease_id = l.id and lt.invite_status = 'accepted'))),
      '{}'
    ),
    last.body,
    last.attachment_path is not null,
    last.created_at,
    last.sender_id,
    (select count(*)::integer from public.messages m
     where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from public.conversations c
  join public.leases l on l.id = c.lease_id
  join public.units u on u.id = l.unit_id
  join public.properties p on p.id = u.property_id
  left join lateral (
    select m.body, m.attachment_path, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last on true
  order by coalesce(last.created_at, l.created_at) desc;
$$;

-- Marks messages from others in a conversation as read; returns how many changed.
create function public.mark_conversation_read(p_conversation_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  changed integer;
begin
  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and read_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
