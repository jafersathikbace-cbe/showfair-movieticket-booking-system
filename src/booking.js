const crypto = require('crypto');

const INDIA_OFFSET = '+05:30';

function generateBookingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[crypto.randomInt(chars.length)];
  return code;
}

function showStartTimestamp(show) {
