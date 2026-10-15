import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dollarsToCents, formatCents } from './money.ts';

test('formatCents formats US dollars', () => {
  assert.equal(formatCents(185000), '$1,850.00');
});

test('dollarsToCents rounds to whole cents', () => {
  assert.equal(dollarsToCents(1850.1), 185010);
  assert.equal(dollarsToCents(0.1 + 0.2), 30);
});
