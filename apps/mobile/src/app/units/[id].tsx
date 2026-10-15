import { formatCents, leaseFormSchema, type LeaseTenant } from '@rental/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Card, SectionTitle } from '@/components/card';
import { Button, FormMessage, TextField } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useForm } from '@/hooks/use-form';
import {
  createLease,
  endLease,
  getUnit,
  revokeInvite,
  type LeaseWithTenants,
  type UnitDetail,
} from '@/lib/landlord';
import { getConversationForLease } from '@/lib/messages';

const INVITE_LABELS: Record<LeaseTenant['invite_status'], string> = {
  pending: 'Invited, waiting for sign-up',
  accepted: 'Joined',
  revoked: 'Removed',
};

export default function UnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: unit, error, reload } = useAsync(() => getUnit(id), [id]);

  if (!unit) {
    return (
      <Screen>
        <FormMessage error>{error}</FormMessage>
        {!error ? <ThemedText type="small">Loading…</ThemedText> : null}
      </Screen>
    );
  }

  const active = unit.leases.find((lease) => lease.status === 'active');
  const past = unit.leases.filter((lease) => lease.status === 'ended');

  return (
    <Screen>
      <Stack.Screen options={{ title: `${unit.properties.name}, ${unit.label}` }} />
      {active ? <ActiveLease lease={active} onChange={reload} /> : <NewLeaseForm unit={unit} onCreated={reload} />}
      {past.length > 0 ? (
        <>
          <SectionTitle>Past leases</SectionTitle>
          {past.map((lease) => (
            <Card key={lease.id}>
              <ThemedText type="small">
                {lease.start_date} to {lease.end_date ?? 'ended early'} · {formatCents(lease.rent_amount)}/mo
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {lease.lease_tenants.map((tenant) => tenant.invite_email).join(', ')}
              </ThemedText>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function ActiveLease({ lease, onChange }: { lease: LeaseWithTenants; onChange: () => void }) {
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(undefined);
    try {
      await action();
      onChange();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle>Current lease</SectionTitle>
      <Card>
        <ThemedText type="smallBold">{formatCents(lease.rent_amount)} per month</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {lease.start_date} to {lease.end_date ?? 'month to month'} · due on day {lease.due_day}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {lease.late_fee > 0
            ? `${formatCents(lease.late_fee)} late fee after ${lease.grace_days} days`
            : 'No late fee'}
        </ThemedText>
      </Card>

      <Button
        title="Message tenants"
        variant="secondary"
        onPress={() =>
          run(async () => {
            const id = await getConversationForLease(lease.id);
            router.push({ pathname: '/messages/[id]', params: { id } });
          })
        }
      />

      <SectionTitle>Tenants</SectionTitle>
      {lease.lease_tenants.map((tenant) => (
        <Card key={tenant.invite_email}>
          <ThemedView type="backgroundElement" style={styles.row}>
            <ThemedView type="backgroundElement" style={styles.grow}>
              <ThemedText type="smallBold">{tenant.invite_email}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {INVITE_LABELS[tenant.invite_status]}
              </ThemedText>
            </ThemedView>
            {tenant.invite_status !== 'revoked' ? (
              <Button
                title="Remove"
                variant="secondary"
                disabled={busy}
                onPress={() => run(() => revokeInvite(lease.id, tenant.invite_email))}
              />
            ) : null}
          </ThemedView>
        </Card>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Invited tenants get access as soon as they sign up or sign in with that email.
      </ThemedText>

      <FormMessage error>{actionError}</FormMessage>
      {confirmingEnd ? (
        <>
          <ThemedText type="small">
            Ending the lease stops rent charges and removes the tenants&apos; access. This cannot be undone.
          </ThemedText>
          <Button title="Yes, end lease" disabled={busy} onPress={() => run(() => endLease(lease.id))} />
          <Button title="Keep lease" variant="secondary" onPress={() => setConfirmingEnd(false)} />
        </>
      ) : (
        <Button title="End lease" variant="secondary" onPress={() => setConfirmingEnd(true)} />
      )}
    </>
  );
}

function firstOfNextMonth(today = new Date()): string {
  const next = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

function NewLeaseForm({ unit, onCreated }: { unit: UnitDetail; onCreated: () => void }) {
  const form = useForm(leaseFormSchema, {
    tenantEmails: '',
    startDate: firstOfNextMonth(),
    endDate: '',
    rentAmount: unit.default_rent ? String(unit.default_rent / 100) : '',
    dueDay: '1',
    graceDays: '5',
    lateFee: '0',
  });

  const onSave = () =>
    form.submit(async (values) => {
      await createLease(unit.id, values);
      onCreated();
    });

  return (
    <>
      <SectionTitle>Start a lease</SectionTitle>
      <ThemedText type="small" themeColor="textSecondary">
        This unit is vacant. Add the lease terms and invite your tenants by email.
      </ThemedText>
      <TextField
        label="Tenant emails"
        placeholder="ana@example.com, ben@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        {...form.field('tenantEmails')}
      />
      <TextField label="Start date (YYYY-MM-DD)" {...form.field('startDate')} />
      <TextField label="End date (optional, blank for month to month)" {...form.field('endDate')} />
      <TextField label="Monthly rent ($)" keyboardType="decimal-pad" {...form.field('rentAmount')} />
      <TextField label="Rent due on day of month" keyboardType="number-pad" {...form.field('dueDay')} />
      <TextField label="Grace period (days)" keyboardType="number-pad" {...form.field('graceDays')} />
      <TextField label="Late fee ($)" keyboardType="decimal-pad" {...form.field('lateFee')} />
      <FormMessage error>{form.formError}</FormMessage>
      <Button
        title={form.submitting ? 'Creating lease…' : 'Create lease and invite'}
        onPress={onSave}
        disabled={form.submitting}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  grow: { flex: 1 },
});
