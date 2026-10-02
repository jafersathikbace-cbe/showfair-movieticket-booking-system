/**
 * ShowFair backend server.
 *
 * Deliberately built on Node's built-in http module (no Express, no third
 * party dependencies) so the project runs anywhere with just `npm install`
 * (a no-op here) and `npm start`.
 *
 * Responsible for:
 *  - Serving the static frontend (public/)
 *  - Catalog, show detail and seat availability data
 *  - Server-side seat holds (the "seat reliability" fix)
 *  - Transparent, backend-computed price breakdowns (the "pricing" fix)
 *  - Booking confirmation + cancellation with a visible cutoff (the
 *    "cancellation clarity" fix)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const {
  PORT, DATA_PATH, PUBLIC_DIR, HOLD_DURATION_MS, CANCEL_WINDOW_MS,
  MAX_SEATS_PER_BOOKING,
} = require('./src/config');
const { seatPrice, priceBreakdown } = require('./src/pricing');
const { isValidSeatId, seatRow, cleanupExpiredHolds, occupiedSeatsForShow, buildSeatMap } = require('./src/seats');
const { normalizeCustomer, isValidEmail, isValidPhone } = require('./src/validation');
const { loadStore, saveStore, getShowContext, getShowDate, localDateString, addDaysToIsoDate } = require('./src/store');
const { generateBookingCode, computeCancelUntil, showStartTimestamp, createId } = require('./src/booking');

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendJson(res, status, obj) {
  applySecurityHeaders(res);
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function formatTime(ts) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(ts));
  const hour = parts.find((p) => p.type === 'hour')?.value || '';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value || '';
  return `${hour}:${minute} ${dayPeriod}`;
}

function dateLabel(date) {
  const d = new Date(`${date}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function serializeBooking(store, booking) {
  const ctx = getShowContext(store, booking.showId);
  return {
    id: booking.id,
    code: booking.code,
    status: booking.status,
    seats: booking.seats,
    customer: booking.customer,
    amount: booking.amount,
    createdAt: booking.createdAt,
    cancelUntil: booking.cancelUntil,
    cancelUntilLabel: formatTime(booking.cancelUntil),
    refund: booking.refund,
    canCancel: booking.status === 'CONFIRMED' && Date.now() < booking.cancelUntil,
    movie: ctx && ctx.movie ? { id: ctx.movie.id, title: ctx.movie.title, poster: ctx.movie.poster } : null,
    theatre: ctx && ctx.theatre ? { id: ctx.theatre.id, name: ctx.theatre.name, area: ctx.theatre.area } : null,
    show: ctx && ctx.show ? {
      id: ctx.show.id,
      date: ctx.show.date,
      dateLabel: dateLabel(ctx.show.date),
      time: ctx.show.time,
      format: ctx.show.format,
    } : null,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handleCatalog(req, res, query) {
  const store = loadStore();
  cleanupExpiredHolds(store);

  const today = localDateString();
  const availableDates = Array.from({ length: 5 }, (_, offset) => {
    const date = addDaysToIsoDate(today, offset);
    return { date, label: dateLabel(date) };
  });
  const requestedDate = query.get('date');
  const selectedDate = availableDates.some((item) => item.date === requestedDate)
    ? requestedDate
    : today;

  const movies = store.movies.map((movie) => {
    const shows = store.shows
      .filter((s) => s.movieId === movie.id && getShowDate(s) === selectedDate && showStartTimestamp({ ...s, date: selectedDate }) > Date.now())
      .map((show) => {
        const theatre = store.theatres.find((t) => t.id === show.theatreId);
        if (!theatre) return null;
        return {
          id: show.id,
          theatreId: theatre.id,
          theatreName: theatre.name,
          area: theatre.area,
          screen: theatre.screen,
          facilities: theatre.facilities,
          date: selectedDate,
          dateLabel: dateLabel(selectedDate),
          time: show.time,
          format: show.format,
          price: show.price,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.time.localeCompare(b.time));

    return { ...movie, shows };
  });

  sendJson(res, 200, { movies, theatres: store.theatres, selectedDate, availableDates });
}

function handleShowDetail(req, res, query) {
  const showId = query.get('id');
  const store = loadStore();
  cleanupExpiredHolds(store);

  const ctx = getShowContext(store, showId);
  if (!ctx) {
    return sendJson(res, 404, { error: 'That showtime could not be found.' });
  }

  const startsAt = showStartTimestamp(ctx.show);
  if (startsAt <= Date.now()) {
    return sendJson(res, 410, { error: 'This show has already started. Please choose another show.' });
  }

  sendJson(res, 200, {
    show: ctx.show,
    movie: ctx.movie,
    theatre: ctx.theatre,
    seatMap: buildSeatMap(store, showId, getShowContext),
    maxSeats: MAX_SEATS_PER_BOOKING,
    holdDurationSeconds: HOLD_DURATION_MS / 1000,
  });
}

async function handleHold(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'That request could not be read. Please try again.' });
  }

  const { showId, seats } = body;
  if (!showId || !Array.isArray(seats) || seats.length === 0) {
    return sendJson(res, 400, { error: 'Choose at least one seat before continuing.' });
  }
  if (seats.length > MAX_SEATS_PER_BOOKING) {
    return sendJson(res, 400, { error: `You can book up to ${MAX_SEATS_PER_BOOKING} seats at a time.` });
  }
  const uniqueSeats = Array.from(new Set(seats));
  if (uniqueSeats.some((s) => !isValidSeatId(s))) {
    return sendJson(res, 400, { error: 'One of the selected seats is not valid. Refresh and choose again.' });
  }

  const store = loadStore();
  cleanupExpiredHolds(store);

  const ctx = getShowContext(store, showId);
  if (!ctx) {
    return sendJson(res, 404, { error: 'That showtime could not be found.' });
  }
  if (showStartTimestamp(ctx.show) <= Date.now()) {
    return sendJson(res, 410, { error: 'This show has already started. Please choose another show.' });
  }

  const occupied = occupiedSeatsForShow(store, showId, null);
  const unavailable = uniqueSeats.filter((s) => occupied.has(s));
  if (unavailable.length > 0) {
    return sendJson(res, 409, {
      error: 'One or more seats are no longer available. Refresh and choose again.',
      seats: unavailable,
    });
  }

  const ticketAmount = uniqueSeats.reduce(
    (sum, seatId) => sum + seatPrice(ctx.show.price, seatRow(seatId)), 0
  );
  const amount = priceBreakdown(ticketAmount);

  const hold = {
    id: createId('hold'),
    showId,
    seats: uniqueSeats,
    expiresAt: Date.now() + HOLD_DURATION_MS,
  };
  store.holds.push(hold);
  saveStore(store);

  sendJson(res, 200, { holdId: hold.id, expiresAt: hold.expiresAt, seats: hold.seats, amount });
}

async function handleBook(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'That request could not be read. Please try again.' });
  }

  const { holdId, customer } = body;
  if (!holdId || !customer) {
    return sendJson(res, 400, { error: 'Booking details are incomplete.' });
  }
  const { name, email, phone } = normalizeCustomer(customer);

  if (name.length < 2) {
    return sendJson(res, 400, { error: 'Please enter your full name.' });
  }
  if (!isValidEmail(email)) {
    return sendJson(res, 400, { error: 'Please enter a valid email address.' });
  }
  if (!isValidPhone(phone)) {
    return sendJson(res, 400, { error: 'Please enter a valid 10-digit mobile number.' });
  }

  const store = loadStore();
  const holdExpiredBeforeCleanup = (() => {
    const h = store.holds.find((x) => x.id === holdId);
    return h ? h.expiresAt <= Date.now() : null;
  })();
  cleanupExpiredHolds(store);

  const hold = store.holds.find((h) => h.id === holdId);
  if (!hold) {
    const message = holdExpiredBeforeCleanup === true
      ? 'Your seat hold has expired. Please select your seats again.'
      : 'Your seat hold could not be found. Please select your seats again.';
    return sendJson(res, 410, { error: message });
  }

  // Re-validate against confirmed bookings in case anything changed.
  const ctx = getShowContext(store, hold.showId);
  if (!ctx) {
    return sendJson(res, 404, { error: 'That showtime could not be found.' });
  }
  if (showStartTimestamp(ctx.show) <= Date.now()) {
    store.holds = store.holds.filter((h) => h.id !== hold.id);
    saveStore(store);
    return sendJson(res, 410, { error: 'This show has already started. Please choose another show.' });
  }
  const occupied = occupiedSeatsForShow(store, hold.showId, hold.id);
  const nowUnavailable = hold.seats.filter((s) => occupied.has(s));
  if (nowUnavailable.length > 0) {
    store.holds = store.holds.filter((h) => h.id !== hold.id);
    saveStore(store);
    return sendJson(res, 409, {
      error: 'One or more seats are no longer available. Refresh and choose again.',
      seats: nowUnavailable,
    });
  }

  const ticketAmount = hold.seats.reduce((sum, seatId) => sum + seatPrice(ctx.show.price, seatRow(seatId)), 0);
  const amount = priceBreakdown(ticketAmount);
  const createdAt = Date.now();
  const cancelUntil = computeCancelUntil(createdAt, ctx.show, CANCEL_WINDOW_MS);

  const booking = {
    id: createId('bk'),
    code: generateBookingCode(),
    showId: hold.showId,
    seats: hold.seats,
    customer: { name, email, phone },
    amount,
    status: 'CONFIRMED',
    createdAt,
    cancelUntil,
    refund: null,
  };

  store.bookings.push(booking);
  store.holds = store.holds.filter((h) => h.id !== hold.id);
  saveStore(store);

  sendJson(res, 201, serializeBooking(store, booking));
