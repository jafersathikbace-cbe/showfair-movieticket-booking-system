const { CONVENIENCE_FEE_RATE, GST_RATE, PREMIUM_SURCHARGE, PREMIUM_ROWS } = require('./config');

function seatTier(row) {
  return PREMIUM_ROWS.has(row) ? 'premium' : 'standard';
}

function seatPrice(basePrice, row) {
  return seatTier(row) === 'premium' ? basePrice + PREMIUM_SURCHARGE : basePrice;
}

function priceBreakdown(ticketAmount) {
  const convenienceFee = Math.round(ticketAmount * CONVENIENCE_FEE_RATE);
  const gst = Math.round((ticketAmount + convenienceFee) * GST_RATE);
  const total = ticketAmount + convenienceFee + gst;
  return { ticketAmount, convenienceFee, gst, total };
}

module.exports = { seatTier, seatPrice, priceBreakdown };
