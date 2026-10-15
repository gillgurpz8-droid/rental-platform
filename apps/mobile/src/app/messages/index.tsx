import { formatMessageTime } from '@rental/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { LinkCard } from '@/components/card';
import { FormMessage } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAsync } from '@/hooks/use-async';
import { conversationTitle, listConversations, type ConversationSummary } from '@/lib/messages';
import { useAuth } from '@/providers/auth';

export default function InboxScreen() {
  const { profile } = useAuth();
  const { data: conversations, error, reload } = useAsync(listConversations, []);
  // Refresh unread counts when coming back from a conversation.
  useFocusEffect(useCallback(() => reload(), [reload]));

  if (!conversations) {
    return (
      <Screen>
        <FormMessage error>{error}</FormMessage>
        {!error ? <ThemedText type="small">Loading…</ThemedText> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      {conversations.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {profile?.role === 'landlord'
            ? 'Each lease gets its own conversation. Start a lease to message your tenants.'
            : 'Your conversation with your landlord appears here once you join a lease.'}
        </ThemedText>
      ) : (
        conversations.map((conversation) => (
          <LinkCard
            key={conversation.conversation_id}
            href={{ pathname: '/messages/[id]', params: { id: conversation.conversation_id } }}
            title={conversationTitle(conversation, profile?.role)}
            detail={preview(conversation, profile?.id)}
            note={note(conversation)}
            highlight={conversation.unread_count > 0}
          />
        ))
      )}
    </Screen>
  );
}

function preview(conversation: ConversationSummary, myId?: string) {
  if (!conversation.last_message_at) return 'No messages yet';
  const prefix = conversation.last_message_sender_id === myId ? 'You: ' : '';
  const body = conversation.last_message_body || (conversation.last_message_has_attachment ? 'Photo' : '');
  const ended = conversation.lease_status === 'ended' ? ' (lease ended)' : '';
  return `${prefix}${body}${ended}`;
}

function note(conversation: ConversationSummary) {
  if (conversation.unread_count > 0) return `${conversation.unread_count} new`;
  return conversation.last_message_at ? formatMessageTime(conversation.last_message_at) : undefined;
}
