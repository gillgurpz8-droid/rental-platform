import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isRentLate, rentDueDate } from './rent.ts';

test('rentDueDate uses the due day when the month has it', () => {
  assert.equal(rentDueDate(2026, 11, 1), '2026-11-01');
});

test('rentDueDate clamps to the last day of short months', () => {
  assert.equal(rentDueDate(2026, 2, 31), '2026-02-28');
  assert.equal(rentDueDate(2028, 2, 31), '2028-02-29');
  assert.equal(rentDueDate(2026, 4, 31), '2026-04-30');
});

test('isRentLate respects the grace period', () => {
  assert.equal(isRentLate('2026-11-01', 5, '2026-11-06'), false);
  assert.equal(isRentLate('2026-11-01', 5, '2026-11-07'), true);
  assert.equal(isRentLate('2026-11-01', 0, '2026-11-01'), false);
});
