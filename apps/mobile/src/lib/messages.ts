import { ATTACHMENT_BUCKET, attachmentPath, type Message } from '@rental/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type ConversationSummary = {
  conversation_id: string;
  lease_id: string;
  lease_status: 'draft' | 'active' | 'ended';
  property_name: string;
  unit_label: string;
  participant_names: string[];
  last_message_body: string | null;
  last_message_has_attachment: boolean | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
};

/** Tenants see the place; landlords also see who they are talking to. */
export function conversationTitle(conversation: ConversationSummary, role?: string) {
  const place = `${conversation.property_name}, ${conversation.unit_label}`;
  if (role === 'tenant') return place;
  const names = conversation.participant_names.join(', ');
  return names ? `${names} · ${place}` : place;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  return check(await supabase.rpc('list_conversations')) ?? [];
}

export async function unreadTotal(): Promise<number> {
  const conversations = await listConversations();
  return conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0);
}

export async function getConversationForLease(leaseId: string): Promise<string> {
  const row = check(
    await supabase.from('conversations').select('id').eq('lease_id', leaseId).single(),
  ) as { id: string };
  return row.id;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  return (
    check(
      await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at')
        .limit(500),
    ) ?? []
  );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachment?: string,
): Promise<Message> {
  return check(
    await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, body, attachment_path: attachment ?? null })
      .select('*')
      .single(),
  );
}

export async function markConversationRead(conversationId: string): Promise<void> {
  check(await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId }));
}

/** Uploads a picked photo into the conversation's folder and returns its storage path. */
export async function uploadAttachment(
  conversationId: string,
  file: { uri: string; fileName?: string | null; mimeType?: string },
): Promise<string> {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = attachmentPath(conversationId, file.fileName ?? file.uri, uniqueId);
  const body = await (await fetch(file.uri)).arrayBuffer();
  check(
    await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, body, { contentType: file.mimeType ?? 'image/jpeg' }),
  );
  return path;
}

/** Short-lived links for private attachments, keyed by storage path. */
export async function signAttachments(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const signed = check(await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, 60 * 60));
  return Object.fromEntries(
    (signed ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [])),
  );
}

/** Calls onInsert for every new message in the conversation, including your own. */
export function subscribeToMessages(conversationId: string, onInsert: (message: Message) => void): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as Message),
    )
    .subscribe();
}
