import { formatCents, unitFormSchema } from '@rental/shared';
import { Stack, useLocalSearchParams } from 'expo-router';

import { LinkCard, SectionTitle } from '@/components/card';
import { Button, FormMessage, TextField } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAsync } from '@/hooks/use-async';
import { useForm } from '@/hooks/use-form';
import { createUnit, getProperty } from '@/lib/landlord';

export default function PropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: property, error, reload } = useAsync(() => getProperty(id), [id]);
  const form = useForm(unitFormSchema, { label: '', bedrooms: '', defaultRent: '' });

  const onAddUnit = () =>
    form.submit(async (values) => {
      await createUnit(id, values);
      form.setValues({ label: '', bedrooms: '', defaultRent: '' });
      reload();
    });

  if (!property) {
    return (
      <Screen>
        <FormMessage error>{error}</FormMessage>
        {!error ? <ThemedText type="small">Loading…</ThemedText> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: property.name }} />
      <ThemedText type="small" themeColor="textSecondary">
        {[property.address_line1, property.address_line2, property.city, property.region, property.postal_code]
          .filter(Boolean)
          .join(', ')}
      </ThemedText>

      <SectionTitle>Units</SectionTitle>
      {property.units.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No units yet. A single-family home is one unit.
        </ThemedText>
      ) : (
        property.units.map((unit) => {
          const active = unit.leases.find((lease) => lease.status === 'active');
          return (
            <LinkCard
              key={unit.id}
              href={{ pathname: '/units/[id]', params: { id: unit.id } }}
              title={unit.label}
              detail={unit.bedrooms !== null ? `${unit.bedrooms} bedrooms` : undefined}
              note={active ? `Leased · ${formatCents(active.rent_amount)}/mo` : 'Vacant'}
            />
          );
        })
      )}

      <SectionTitle>Add a unit</SectionTitle>
      <TextField label="Unit name" placeholder="Apt 2B, or Main house" {...form.field('label')} />
      <TextField label="Bedrooms (optional)" keyboardType="number-pad" {...form.field('bedrooms')} />
      <TextField
        label="Usual monthly rent (optional)"
        placeholder="1850"
        keyboardType="decimal-pad"
        {...form.field('defaultRent')}
      />
      <FormMessage error>{form.formError}</FormMessage>
      <Button title={form.submitting ? 'Adding…' : 'Add unit'} onPress={onAddUnit} disabled={form.submitting} />
    </Screen>
  );
}
