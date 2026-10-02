const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server');

test('unsupported methods return 405 with an Allow header', async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
