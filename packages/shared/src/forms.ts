import { z } from 'zod';

import { dollarsToCents } from './money.ts';

// Schemas for landlord forms. Inputs are the raw strings from text fields;
// outputs are typed values ready to write to the database (money in cents).

const requiredText = (message: string) => z.string().trim().min(1, message);

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value));

/** "1,850.50" or "$1850" → 185050 cents. */
const dollars = (message: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const cleaned = value.replace(/[$,\s]/g, '');
      if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return dollarsToCents(Number(cleaned));
    });

const wholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const n = Number(value);
      if (value === '' || !Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return n;
    });

const isoDate = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, message);

export const propertyFormSchema = z.object({
  name: requiredText('Give the property a name'),
  addressLine1: requiredText('Enter the street address'),
  addressLine2: optionalText,
  city: requiredText('Enter the city'),
  region: requiredText('Enter the state'),
  postalCode: requiredText('Enter the ZIP code'),
});

export const unitFormSchema = z.object({
  label: requiredText('Name the unit, for example Apt 2B'),
  bedrooms: z.union([z.literal('').transform(() => null), wholeNumber(0, 50, 'Bedrooms must be a whole number')]),
  defaultRent: z.union([
    z.literal('').transform(() => null),
    dollars('Enter rent as an amount, for example 1850'),
  ]),
});

export const leaseFormSchema = z
  .object({
    tenantEmails: z.string().transform((value, ctx) => {
      const emails = value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      if (emails.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Add at least one tenant email' });
        return z.NEVER;
      }
      const invalid = emails.find((email) => !z.email().safeParse(email).success);
      if (invalid) {
        ctx.addIssue({ code: 'custom', message: `${invalid} is not a valid email` });
        return z.NEVER;
      }
      return [...new Set(emails)];
    }),
    startDate: isoDate('Enter the start date as YYYY-MM-DD'),
    endDate: z.union([z.literal('').transform(() => null), isoDate('Enter the end date as YYYY-MM-DD')]),
    rentAmount: dollars('Enter the monthly rent, for example 1850').refine(
      (cents) => cents > 0,
      'Rent must be more than zero',
    ),
    dueDay: wholeNumber(1, 31, 'Due day must be between 1 and 31'),
    graceDays: wholeNumber(0, 31, 'Grace period must be between 0 and 31 days'),
    lateFee: dollars('Enter the late fee as an amount, or 0'),
  })
  .refine((lease) => lease.endDate === null || lease.endDate > lease.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

export type PropertyFormInput = z.input<typeof propertyFormSchema>;
export type PropertyFormValues = z.output<typeof propertyFormSchema>;
export type UnitFormInput = z.input<typeof unitFormSchema>;
export type UnitFormValues = z.output<typeof unitFormSchema>;
export type LeaseFormInput = z.input<typeof leaseFormSchema>;
export type LeaseFormValues = z.output<typeof leaseFormSchema>;
