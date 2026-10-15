import { formatCents, type Lease, type Property, type Unit } from '@rental/shared';
import { router } from 'expo-router';

import { Card, LinkCard, SectionTitle } from '@/components/card';
import { Button, FormMessage } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAsync } from '@/hooks/use-async';
import { listProperties } from '@/lib/landlord';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';

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
  const { data: properties, error } = useAsync(listProperties, []);

  return (
    <>
      <SectionTitle>Your properties</SectionTitle>
      <FormMessage error>{error}</FormMessage>
      {!properties ? (
        <ThemedText type="small">Loading your properties…</ThemedText>
      ) : properties.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Add your first property, then its units, then a lease for each occupied unit.
        </ThemedText>
      ) : (
        properties.map((property) => {
          const occupied = property.units.filter((unit) =>
            unit.leases.some((lease) => lease.status === 'active'),
          ).length;
          return (
            <LinkCard
              key={property.id}
              href={{ pathname: '/properties/[id]', params: { id: property.id } }}
              title={property.name}
              detail={`${property.address_line1}, ${property.city}`}
              note={`${occupied} of ${property.units.length} units leased`}
            />
          );
        })
      )}
      <Button title="Add property" onPress={() => router.push('/properties/new')} />
    </>
  );
}

function TenantHome() {
  const { data: leases, error } = useAsync(async () => {
    const { data, error: queryError } = await supabase
      .from('leases')
      .select('*, units(label, properties(name))')
      .eq('status', 'active');
    if (queryError) throw new Error(queryError.message);
    return data as LeaseWithUnit[];
  }, []);

  return (
    <>
      <SectionTitle>Your lease</SectionTitle>
      <FormMessage error>{error}</FormMessage>
      {!leases ? (
        <ThemedText type="small">Loading your lease…</ThemedText>
      ) : leases.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No lease yet. Ask your landlord to invite the email you signed up with.
        </ThemedText>
      ) : (
        leases.map((lease) => (
          <Card key={lease.id}>
            <ThemedText type="smallBold">
              {lease.units.properties.name}, {lease.units.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatCents(lease.rent_amount)} due on day {lease.due_day} of each month
            </ThemedText>
          </Card>
        ))
      )}
    </>
  );
}
