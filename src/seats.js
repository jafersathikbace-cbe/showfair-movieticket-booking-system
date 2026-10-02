const { ROWS, SEATS_PER_ROW } = require('./config');
const { seatTier, seatPrice } = require('./pricing');
const { isValidSeatId } = require('./validation');

function seatRow(id) {
  return id.charAt(0);
}

function cleanupExpiredHolds(store, now = Date.now()) {
  const before = store.holds.length;
  store.holds = store.holds.filter((hold) => hold.expiresAt > now);
  return store.holds.length !== before;
}

function occupiedSeatsForShow(store, showId, excludeHoldId, now = Date.now()) {
  const occupied = new Set(store.seatSeeds[showId] || []);
  for (const booking of store.bookings) {
    if (booking.showId === showId && booking.status === 'CONFIRMED') {
      booking.seats.forEach((seat) => occupied.add(seat));
    }
  }
  for (const hold of store.holds) {
    if (hold.showId === showId && hold.expiresAt > now && hold.id !== excludeHoldId) {
      hold.seats.forEach((seat) => occupied.add(seat));
    }
  }
  return occupied;
}

function buildSeatMap(store, showId, getShowContext) {
  const context = getShowContext(store, showId);
  if (!context) return null;
  const occupied = occupiedSeatsForShow(store, showId, null);
  return ROWS.map((row) => ({
    row,
    seats: Array.from({ length: SEATS_PER_ROW }, (_, index) => {
      const number = index + 1;
      const id = `${row}${number}`;
      return {
        id,
        row,
        number,
        tier: seatTier(row),
        price: seatPrice(context.show.price, row),
        status: occupied.has(id) ? 'occupied' : 'available',
      };
    }),
  }));
}

module.exports = { seatRow, cleanupExpiredHolds, occupiedSeatsForShow, buildSeatMap, isValidSeatId };
