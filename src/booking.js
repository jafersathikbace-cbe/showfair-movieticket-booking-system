const crypto = require('crypto');

const INDIA_OFFSET = '+05:30';

function generateBookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[crypto.randomInt(chars.length)];
  return code;
}

function showStartTimestamp(show) {
  return new Date(`${show.date}T${show.time}:00${INDIA_OFFSET}`).getTime();
}

function computeCancelUntil(createdAt, show, cancellationWindowMs) {
  return Math.min(createdAt + cancellationWindowMs, showStartTimestamp(show));
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

module.exports = { generateBookingCode, computeCancelUntil, showStartTimestamp, createId };
