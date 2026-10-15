import { signUpSchema, type Role } from '@rental/shared';
import { Link } from 'expo-router';
import { useState } from 'react';

import { Button, FormMessage, SegmentedControl, TextField } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const [role, setRole] = useState<Role>('landlord');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const parsed = signUpSchema.safeParse({ role, fullName, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      // Read by the handle_new_user trigger to create the profile.
      options: { data: { role: parsed.data.role, full_name: parsed.data.fullName } },
    });
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
    } else if (!data.session) {
      setNotice('Check your email to confirm your account, then sign in.');
    }
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Create an account</ThemedText>
      <ThemedText type="smallBold">I am a</ThemedText>
      <SegmentedControl
        options={[
          { value: 'landlord', label: 'Landlord' },
          { value: 'tenant', label: 'Tenant' },
        ]}
        value={role}
        onChange={setRole}
      />
      {role === 'tenant' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Use the email your landlord invited so your lease shows up automatically.
        </ThemedText>
      ) : null}
      <TextField label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
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
        autoComplete="new-password"
      />
      <FormMessage error>{error}</FormMessage>
      <FormMessage>{notice}</FormMessage>
      <Button title={submitting ? 'Creating account…' : 'Create account'} onPress={onSubmit} disabled={submitting} />
      <Link href="/sign-in">
        <ThemedText type="linkPrimary">Already have an account? Sign in</ThemedText>
      </Link>
    </Screen>
  );
}
