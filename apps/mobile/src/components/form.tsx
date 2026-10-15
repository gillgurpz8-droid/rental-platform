import { Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TextField({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        {...props}
      />
      {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
    </ThemedView>
  );
}

export function FormMessage({ error, children }: { error?: boolean; children?: string }) {
  if (!children) return null;
  return (
    <ThemedText type="small" style={error ? styles.error : undefined}>
      {children}
    </ThemedText>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? Brand : theme.backgroundElement },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <ThemedText type="smallBold" style={primary ? styles.primaryText : undefined}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.segments}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={styles.segmentPressable}>
          <ThemedView
            type={option.value === value ? 'background' : 'backgroundElement'}
            style={styles.segment}>
            <ThemedText type="small" themeColor={option.value === value ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const Brand = '#208AEF';

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 16,
  },
  error: { color: '#D93025' },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three - Spacing.one,
    alignItems: 'center',
  },
  primaryText: { color: '#ffffff' },
  dimmed: { opacity: 0.6 },
  segments: { flexDirection: 'row', borderRadius: Spacing.two, padding: Spacing.half },
  segmentPressable: { flex: 1 },
  segment: { borderRadius: Spacing.two - 2, paddingVertical: Spacing.two, alignItems: 'center' },
});
