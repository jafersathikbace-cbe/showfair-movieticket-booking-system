const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server');

async function withServer(run) {
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const port = server.address().port;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health endpoint reports service status', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'showfair' });
  });
});

test('unknown API routes return JSON errors', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/does-not-exist`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'Unknown API endpoint.');
  });
});
