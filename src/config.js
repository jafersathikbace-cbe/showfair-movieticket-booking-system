const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  DATA_PATH: path.join(ROOT_DIR, 'data', 'store.json'),
  PUBLIC_DIR: path.join(ROOT_DIR, 'public'),
  HOLD_DURATION_MS: 7 * 60 * 1000,
  CANCEL_WINDOW_MS: 2.5 * 60 * 60 * 1000,
  CONVENIENCE_FEE_RATE: 0.06,
  GST_RATE: 0.18,
  PREMIUM_SURCHARGE: 40,
  MAX_SEATS_PER_BOOKING: 8,
  ROWS: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  SEATS_PER_ROW: 10,
  PREMIUM_ROWS: new Set(['A', 'B']),
};
