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
