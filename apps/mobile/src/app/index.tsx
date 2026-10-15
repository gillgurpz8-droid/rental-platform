import { formatCents, type Lease, type Property, type Unit } from '@rental/shared';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

type PropertyWithUnits = Property & { units: Pick<Unit, 'id'>[] };
type LeaseWithUnit = Lease & { units: Pick<Unit, 'label'> & { properties: Pick<Property, 'name'> } };

export default function HomeScreen() {
  const { profile } = useAuth();
  const firstName = profile?.full_name.split(' ')[0] || 'there';

  return (
    <Screen>
      <ThemedText type="subtitle">Hi, {firstName}</ThemedText>
      {profile?.role === 'landlord' ? <LandlordHome /> : <TenantHome />}
      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

function LandlordHome() {
  const [properties, setProperties] = useState<PropertyWithUnits[]>();

  useEffect(() => {
    supabase
      .from('properties')
      .select('*, units(id)')
      .order('created_at')
      .then(({ data }) => setProperties((data ?? []) as PropertyWithUnits[]));
  }, []);

  if (!properties) return <ThemedText type="small">Loading your properties…</ThemedText>;

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold">Your properties</ThemedText>
      {properties.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No properties yet. Adding properties, units and leases comes next.
        </ThemedText>
      ) : (
        properties.map((property) => (
          <ThemedView key={property.id} type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{property.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {property.address_line1}, {property.city} · {property.units.length} units
            </ThemedText>
          </ThemedView>
        ))
      )}
    </ThemedView>
  );
}

function TenantHome() {
  const [leases, setLeases] = useState<LeaseWithUnit[]>();

  useEffect(() => {
    supabase
      .from('leases')
      .select('*, units(label, properties(name))')
      .then(({ data }) => setLeases((data ?? []) as LeaseWithUnit[]));
  }, []);

  if (!leases) return <ThemedText type="small">Loading your lease…</ThemedText>;

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold">Your lease</ThemedText>
      {leases.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No lease yet. Ask your landlord to invite the email you signed up with.
        </ThemedText>
      ) : (
        leases.map((lease) => (
          <ThemedView key={lease.id} type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              {lease.units.properties.name}, {lease.units.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatCents(lease.rent_amount)} due on day {lease.due_day} of each month
            </ThemedText>
          </ThemedView>
        ))
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
});
