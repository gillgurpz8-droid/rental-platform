import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attachmentPath, formatMessageTime, messageBodySchema } from './messages.ts';

test('attachmentPath puts the file under the conversation folder', () => {
  assert.equal(attachmentPath('conv-1', 'IMG_0042.HEIC', 'abc'), 'conv-1/abc.heic');
  assert.equal(attachmentPath('conv-1', 'photo', 'abc'), 'conv-1/abc.jpg');
});

test('formatMessageTime shows time today, weekday this week, date otherwise', () => {
  const now = new Date('2026-10-15T18:00:00Z');
  const tz = 'UTC';
  assert.equal(formatMessageTime('2026-10-15T09:05:00Z', now, 'en-US', tz), '9:05 AM');
  assert.equal(formatMessageTime('2026-10-13T09:05:00Z', now, 'en-US', tz), 'Tue');
  assert.equal(formatMessageTime('2026-09-30T09:05:00Z', now, 'en-US', tz), 'Sep 30');
});

test('messageBodySchema trims and limits length', () => {
  assert.equal(messageBodySchema.parse('  hi  '), 'hi');
  assert.equal(messageBodySchema.safeParse('x'.repeat(4001)).success, false);
});
