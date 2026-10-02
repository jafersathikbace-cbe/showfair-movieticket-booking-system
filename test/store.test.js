const test = require('node:test');
const assert = require('node:assert/strict');
const { loadStore, getShowContext } = require('../src/store');

test('demo store loads the catalog collections', () => {
  const store = loadStore();
  assert.ok(store.movies.length > 0);
  assert.ok(store.theatres.length > 0);
  assert.ok(store.shows.length > 0);
  assert.ok(Array.isArray(store.bookings));
});

test('show context joins show, movie, and theatre records', () => {
  const store = loadStore();
  const context = getShowContext(store, store.shows[0].id);
  assert.equal(context.show.id, store.shows[0].id);
  assert.equal(context.movie.id, store.shows[0].movieId);
  assert.equal(context.theatre.id, store.shows[0].theatreId);
});
