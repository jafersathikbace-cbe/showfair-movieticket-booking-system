const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidSeatId, isValidEmail, isValidPhone, normalizeCustomer } = require('../src/validation');

test('seat ids accept rows A-H and seats 1-10', () => {
  assert.equal(isValidSeatId('A1'), true);
  assert.equal(isValidSeatId('H10'), true);
  assert.equal(isValidSeatId('I1'), false);
  assert.equal(isValidSeatId('A11'), false);
});

test('customer contact validation rejects malformed values', () => {
  assert.equal(isValidEmail('guest@example.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidPhone('9876543210'), true);
  assert.equal(isValidPhone('12345'), false);
});

test('customer normalization trims and lowercases email', () => {
  assert.deepEqual(normalizeCustomer({ name: '  Jafer ', email: ' JAFER@EXAMPLE.COM ', phone: '9876543210' }), {
    name: 'Jafer', email: 'jafer@example.com', phone: '9876543210',
  });
});
