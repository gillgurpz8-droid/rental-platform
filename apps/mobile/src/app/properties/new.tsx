import { propertyFormSchema } from '@rental/shared';
import { router } from 'expo-router';

import { Button, FormMessage, TextField } from '@/components/form';
import { Screen } from '@/components/screen';
import { useForm } from '@/hooks/use-form';
import { createProperty } from '@/lib/landlord';
import { useAuth } from '@/providers/auth';

export default function NewPropertyScreen() {
  const { profile } = useAuth();
  const form = useForm(propertyFormSchema, {
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    postalCode: '',
  });

  const onSave = () =>
    form.submit(async (values) => {
      if (!profile) return;
      const id = await createProperty(profile.id, values);
      router.replace({ pathname: '/properties/[id]', params: { id } });
    });

  return (
    <Screen>
      <TextField label="Property name" placeholder="Elm Street Duplex" {...form.field('name')} />
      <TextField label="Street address" autoComplete="street-address" {...form.field('addressLine1')} />
      <TextField label="Address line 2 (optional)" {...form.field('addressLine2')} />
      <TextField label="City" {...form.field('city')} />
      <TextField label="State" autoCapitalize="characters" {...form.field('region')} />
      <TextField label="ZIP code" keyboardType="number-pad" autoComplete="postal-code" {...form.field('postalCode')} />
      <FormMessage error>{form.formError}</FormMessage>
      <Button title={form.submitting ? 'Saving…' : 'Save property'} onPress={onSave} disabled={form.submitting} />
    </Screen>
  );
}
