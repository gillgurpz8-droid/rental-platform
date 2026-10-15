import { signInSchema } from '@rental/shared';
import { Link } from 'expo-router';
import { useState } from 'react';

import { Button, FormMessage, TextField } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);
    if (authError) setError(authError.message);
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Sign in</ThemedText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
      <FormMessage error>{error}</FormMessage>
      <Button title={submitting ? 'Signing in…' : 'Sign in'} onPress={onSubmit} disabled={submitting} />
      <Link href="/sign-up">
        <ThemedText type="linkPrimary">New here? Create an account</ThemedText>
      </Link>
    </Screen>
  );
}
