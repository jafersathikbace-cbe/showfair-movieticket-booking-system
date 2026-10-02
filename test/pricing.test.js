const test = require('node:test');
const assert = require('node:assert/strict');
const { seatTier, seatPrice, priceBreakdown } = require('../src/pricing');

test('premium rows carry the premium tier', () => {
  assert.equal(seatTier('A'), 'premium');
  assert.equal(seatTier('C'), 'standard');
});

test('premium seats add the configured surcharge', () => {
  assert.equal(seatPrice(150, 'A'), 190);
  assert.equal(seatPrice(150, 'C'), 150);
});

test('price breakdown applies fee and GST in order', () => {
  assert.deepEqual(priceBreakdown(300), {
    ticketAmount: 300,
    convenienceFee: 18,
    gst: 57,
    total: 375,
  });
});
