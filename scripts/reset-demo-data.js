const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'store.json');
const store = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
store.holds = [];
store.bookings = [];
fs.writeFileSync(dataPath, JSON.stringify(store, null, 2) + '\n');
console.log('ShowFair demo data reset: active holds and bookings cleared.');
