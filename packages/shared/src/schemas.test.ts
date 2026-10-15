import assert from 'node:assert/strict';
import { test } from 'node:test';

import { signUpSchema } from './schemas.ts';

test('signUpSchema reports the top-most missing field first', () => {
  const result = signUpSchema.safeParse({ role: 'tenant', fullName: '', email: '', password: '' });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, 'Enter your name');
});

test('signUpSchema rejects unknown roles', () => {
  const result = signUpSchema.safeParse({ role: 'admin', fullName: 'A', email: 'a@b.co', password: '12345678' });
  assert.equal(result.success, false);
});
