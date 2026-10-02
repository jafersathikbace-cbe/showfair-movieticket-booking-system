function isValidSeatId(id) {
  return /^([A-H])([1-9]|10)$/.test(id);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(String(phone || '').trim());
}

function normalizeCustomer(customer = {}) {
  return {
    name: String(customer.name || '').trim(),
    email: String(customer.email || '').trim().toLowerCase(),
    phone: String(customer.phone || '').trim(),
  };
}

module.exports = { isValidSeatId, isValidEmail, isValidPhone, normalizeCustomer };
