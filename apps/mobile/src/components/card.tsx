import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function Card({ children }: { children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {children}
    </ThemedView>
  );
}

/** A tappable card with a title, an optional detail line and a trailing note. */
export function LinkCard({
  href,
  title,
  detail,
  note,
}: {
  href: Href;
  title: string;
  detail?: string;
  note?: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <Card>
          <ThemedView type="backgroundElement" style={styles.row}>
            <ThemedText type="smallBold" style={styles.title}>
              {title}
            </ThemedText>
            {note ? (
              <ThemedText type="small" themeColor="textSecondary">
                {note}
              </ThemedText>
            ) : null}
          </ThemedView>
          {detail ? (
            <ThemedText type="small" themeColor="textSecondary">
              {detail}
            </ThemedText>
          ) : null}
        </Card>
      </Pressable>
    </Link>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" style={styles.section}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
  pressed: { opacity: 0.7 },
  section: { marginTop: Spacing.two },
});
