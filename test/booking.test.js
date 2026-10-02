const test = require('node:test');
const assert = require('node:assert/strict');
const { computeCancelUntil, generateBookingCode, createId } = require('../src/booking');

test('cancellation cutoff never extends beyond showtime', () => {
  const createdAt = new Date('2026-09-25T12:00:00').getTime();
  const show = { date: '2026-09-25', time: '13:00' };
  assert.equal(computeCancelUntil(createdAt, show, 2.5 * 60 * 60 * 1000), new Date('2026-09-25T13:00:00+05:30').getTime());
});

test('booking codes use six non-ambiguous characters', () => {
  const code = generateBookingCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
});

test('generated ids contain the requested prefix', () => {
  assert.match(createId('bk'), /^bk_[a-f0-9]{12}$/);
});
