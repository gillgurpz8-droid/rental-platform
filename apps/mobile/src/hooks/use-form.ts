import { useState } from 'react';
import type { z } from 'zod';

/**
 * Text-field form state validated by a Zod schema. `submit` validates, shows the
 * first error per field, and calls `onValid` with the parsed values.
 */
export function useForm<S extends z.ZodType<unknown, Record<string, string>>>(
  schema: S,
  initial: z.input<S>,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof z.input<S>, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const field = (name: keyof z.input<S> & string) => ({
    value: values[name],
    onChangeText: (text: string) => setValues((previous) => ({ ...previous, [name]: text })),
    error: errors[name],
  });

  async function submit(onValid: (values: z.output<S>) => Promise<void>) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof z.input<S>, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof z.input<S>;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError(undefined);
    setSubmitting(true);
    try {
      await onValid(parsed.data);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return { values, setValues, field, submit, submitting, formError };
}
