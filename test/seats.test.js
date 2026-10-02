const test = require('node:test');
const assert = require('node:assert/strict');
const { occupiedSeatsForShow, cleanupExpiredHolds, buildSeatMap } = require('../src/seats');
const { getShowContext } = require('../src/store');

function storeFixture() {
  return {
    seatSeeds: { s1: ['A1'] },
    holds: [
      { id: 'expired', showId: 's1', seats: ['B1'], expiresAt: 100 },
      { id: 'active', showId: 's1', seats: ['C1'], expiresAt: 2000 },
    ],
    bookings: [{ showId: 's1', seats: ['D1'], status: 'CONFIRMED' }],
    shows: [{ id: 's1', movieId: 'm1', theatreId: 't1', price: 150 }],
    movies: [{ id: 'm1', title: 'Test', poster: '' }],
    theatres: [{ id: 't1', name: 'Test Theatre', area: 'Test' }],
  };
}

test('occupied seats combine seeded, confirmed, and active held seats', () => {
  const occupied = occupiedSeatsForShow(storeFixture(), 's1', null, 1000);
  assert.deepEqual([...occupied].sort(), ['A1', 'C1', 'D1']);
});

test('expired holds are removed during cleanup', () => {
  const store = storeFixture();
  assert.equal(cleanupExpiredHolds(store, 1000), true);
  assert.deepEqual(store.holds.map((h) => h.id), ['active']);
});

test('seat map exposes price and availability for every seat', () => {
  const store = storeFixture();
  const map = buildSeatMap(store, 's1', getShowContext);
  assert.equal(map.length, 8);
  assert.equal(map[0].seats.length, 10);
  assert.equal(map[0].seats[0].status, 'occupied');
  assert.equal(map[2].seats[0].status, 'available');
});
