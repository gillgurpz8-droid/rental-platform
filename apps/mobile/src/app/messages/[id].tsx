import { formatMessageTime, messageBodySchema, type Message, type Profile } from '@rental/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormMessage } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  conversationTitle,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  signAttachments,
  subscribeToMessages,
  uploadAttachment,
} from '@/lib/messages';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const theme = useTheme();
  const [title, setTitle] = useState('Messages');
  const [messages, setMessages] = useState<Message[]>();
  const [names, setNames] = useState<Record<string, string>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const list = useRef<FlatList<Message>>(null);

  // Adds messages without duplicates (our own sends also arrive over realtime).
  const merge = useCallback((incoming: Message[]) => {
    setMessages((current) => {
      const byId = new Map((current ?? []).map((message) => [message.id, message]));
      for (const message of incoming) byId.set(message.id, message);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      merge(await listMessages(id));
      await markConversationRead(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, merge]);

  useEffect(() => {
    refresh();
    listConversations().then((all) => {
      const conversation = all.find((c) => c.conversation_id === id);
      if (conversation) setTitle(conversationTitle(conversation, profile?.role));
    });
    const channel = subscribeToMessages(id, (message) => {
      merge([message]);
      if (message.sender_id !== profile?.id) markConversationRead(id).catch(() => {});
    });
    // Catch up on anything missed while the app was in the background.
    const appState = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      supabase.removeChannel(channel);
      appState.remove();
    };
  }, [id, profile?.id, profile?.role, merge, refresh]);

  // Look up sender names and sign attachment links for messages we haven't seen yet.
  useEffect(() => {
    if (!messages) return;
    const unknownSenders = [...new Set(messages.map((m) => m.sender_id))].filter((s) => !(s in names));
    if (unknownSenders.length > 0) {
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', unknownSenders)
        .then(({ data }) => {
          const found = Object.fromEntries(
            ((data ?? []) as Pick<Profile, 'id' | 'full_name'>[]).map((p) => [p.id, p.full_name]),
          );
          // Remember misses too so we don't ask again.
          setNames((current) => ({ ...Object.fromEntries(unknownSenders.map((s) => [s, ''])), ...current, ...found }));
        });
    }
    const unsigned = messages.flatMap((m) => (m.attachment_path && !(m.attachment_path in imageUrls) ? [m.attachment_path] : []));
    if (unsigned.length > 0) {
      signAttachments(unsigned).then((urls) => setImageUrls((current) => ({ ...current, ...urls })));
    }
  }, [messages, names, imageUrls]);

  async function send(attachment?: string) {
    if (!profile) return;
    const parsed = messageBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    if (!parsed.data && !attachment) return;
    setSending(true);
    setError(undefined);
    try {
      merge([await sendMessage(id, profile.id, parsed.data, attachment)]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function attachPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setSending(true);
    try {
      const path = await uploadAttachment(id, result.assets[0]);
      await send(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  }

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title }} />
      <SafeAreaView style={styles.fill} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
          <FlatList
            ref={list}
            style={styles.fill}
            contentContainerStyle={styles.list}
            data={messages ?? []}
            keyExtractor={(message) => message.id}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              messages ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                  No messages yet. Say hello, or report a repair with a photo.
                </ThemedText>
              ) : (
                <ThemedText type="small">Loading…</ThemedText>
              )
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === profile?.id;
              const imageUrl = item.attachment_path ? imageUrls[item.attachment_path] : undefined;
              return (
                <ThemedView style={[styles.messageRow, mine && styles.mineRow]}>
                  {!mine && names[item.sender_id] ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {names[item.sender_id]}
                    </ThemedText>
                  ) : null}
                  <ThemedView
                    type={mine ? undefined : 'backgroundElement'}
                    style={[styles.bubble, mine && styles.mineBubble]}>
                    {item.attachment_path ? (
                      imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.photo} contentFit="cover" accessibilityLabel="Attached photo" />
                      ) : (
                        <ThemedText type="small">Loading photo…</ThemedText>
                      )
                    ) : null}
                    {item.body ? (
                      <ThemedText style={mine ? styles.mineText : undefined}>{item.body}</ThemedText>
                    ) : null}
                  </ThemedView>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                    {formatMessageTime(item.created_at)}
                    {mine && item.read_at ? ' · Read' : ''}
                  </ThemedText>
                </ThemedView>
              );
            }}
          />
          <ThemedView style={styles.composerWrap}>
            <FormMessage error>{error}</FormMessage>
            <ThemedView style={styles.composer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Attach photo"
                onPress={attachPhoto}
                disabled={sending}
                style={[styles.iconButton, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">+</ThemedText>
              </Pressable>
              <TextInput
                accessibilityLabel="Message"
                placeholder="Write a message"
                placeholderTextColor={theme.textSecondary}
                value={draft}
                onChangeText={setDraft}
                multiline
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                onPress={() => send()}
                disabled={sending || !draft.trim()}
                style={[styles.sendButton, (sending || !draft.trim()) && styles.dimmed]}>
                <ThemedText type="smallBold" style={styles.mineText}>
                  Send
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  messageRow: { alignItems: 'flex-start', gap: Spacing.half, maxWidth: '85%' },
  mineRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  mineBubble: { backgroundColor: Brand },
  mineText: { color: '#ffffff' },
  photo: { width: 220, height: 220, borderRadius: Spacing.two },
  time: { fontSize: 12 },
  composerWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  sendButton: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    backgroundColor: Brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.5 },
});
