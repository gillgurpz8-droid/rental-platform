import assert from 'node:assert/strict';
import { test } from 'node:test';

import { leaseFormSchema, propertyFormSchema, unitFormSchema } from './forms.ts';

const lease = {
  tenantEmails: 'Ana@Example.com, bo@example.com\nana@example.com',
  startDate: '2026-11-01',
  endDate: '',
  rentAmount: '$1,850.50',
  dueDay: '1',
  graceDays: '5',
  lateFee: '50',
};

test('leaseFormSchema converts form strings to database values', () => {
  const result = leaseFormSchema.parse(lease);
  assert.deepEqual(result, {
    tenantEmails: ['ana@example.com', 'bo@example.com'],
    startDate: '2026-11-01',
    endDate: null,
    rentAmount: 185050,
    dueDay: 1,
    graceDays: 5,
    lateFee: 5000,
  });
});

test('leaseFormSchema rejects bad input with readable messages', () => {
  const messages = (input: Partial<typeof lease>) => {
    const result = leaseFormSchema.safeParse({ ...lease, ...input });
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };
  assert.deepEqual(messages({ tenantEmails: ' ' }), ['Add at least one tenant email']);
  assert.deepEqual(messages({ tenantEmails: 'ana@example' }), ['ana@example is not a valid email']);
  assert.deepEqual(messages({ startDate: '2026-02-30' }), ['Enter the start date as YYYY-MM-DD']);
  assert.deepEqual(messages({ endDate: '2026-10-01' }), ['End date must be after the start date']);
  assert.deepEqual(messages({ rentAmount: '0' }), ['Rent must be more than zero']);
  assert.deepEqual(messages({ rentAmount: '12.345' }), ['Enter the monthly rent, for example 1850']);
  assert.deepEqual(messages({ dueDay: '32' }), ['Due day must be between 1 and 31']);
});

test('propertyFormSchema trims and makes the second address line optional', () => {
  const result = propertyFormSchema.parse({
    name: ' Elm St ',
    addressLine1: '1 Elm St',
    addressLine2: ' ',
    city: 'Austin',
    region: 'TX',
    postalCode: '78701',
  });
  assert.equal(result.name, 'Elm St');
  assert.equal(result.addressLine2, null);
});

test('unitFormSchema allows blank optional fields', () => {
  assert.deepEqual(unitFormSchema.parse({ label: 'Apt 1', bedrooms: '', defaultRent: '' }), {
    label: 'Apt 1',
    bedrooms: null,
    defaultRent: null,
  });
  assert.deepEqual(unitFormSchema.parse({ label: 'Apt 2', bedrooms: '2', defaultRent: '1200' }), {
    label: 'Apt 2',
    bedrooms: 2,
    defaultRent: 120000,
  });
});
