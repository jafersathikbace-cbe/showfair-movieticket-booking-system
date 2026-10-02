const test = require('node:test');
const assert = require('node:assert/strict');
const { priceBreakdown } = require('../src/pricing');

test('pricing rounds each fee independently before calculating total', () => {
  const result = priceBreakdown(101);
  assert.equal(result.convenienceFee, 6);
  assert.equal(result.gst, 19);
  assert.equal(result.total, 126);
});
