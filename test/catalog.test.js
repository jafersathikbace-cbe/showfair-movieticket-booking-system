const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server');
const { localDateString, addDaysToIsoDate } = require('../src/store');

async function withServer(run) {
  await new Promise((resolve) => server.listen(0, resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('catalog is Tamil-only and exposes five rolling show dates', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/catalog`);
    assert.equal(response.status, 200);
    const data = await response.json();

    assert.equal(data.selectedDate, localDateString());
    assert.equal(data.availableDates.length, 5);
    assert.ok(data.movies.every((movie) => movie.language === 'Tamil'));
    assert.ok(data.movies.some((movie) => movie.shows.length > 0));
    assert.ok(data.movies.flatMap((movie) => movie.shows).every((show) => show.date === data.selectedDate));
  });
});

test('catalog can switch to a future date', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/catalog?date=${encodeURIComponent(
      addDaysToIsoDate(localDateString(), 2)
    )}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.availableDates.some((item) => item.date === data.selectedDate));
  });
});
