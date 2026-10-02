const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server');

test('health response includes security headers', async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
