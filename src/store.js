const fs = require('fs');
const { DATA_PATH } = require('./config');

const INDIA_TIME_ZONE = 'Asia/Kolkata';

function loadStore() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function saveStore(store) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

function localDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDaysToIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function getShowDate(show, baseDate = new Date()) {
  if (Number.isInteger(show.dayOffset)) {
    return addDaysToIsoDate(localDateString(baseDate), show.dayOffset);
  }
  return show.date;
}

function getShowContext(store, showId) {
  const show = store.shows.find((item) => item.id === showId);
  if (!show) return null;
  const movie = store.movies.find((item) => item.id === show.movieId);
  const theatre = store.theatres.find((item) => item.id === show.theatreId);
  if (!movie || !theatre) return null;
  return {
    show: { ...show, date: getShowDate(show) },
    movie,
    theatre,
  };
}

module.exports = { loadStore, saveStore, getShowContext, getShowDate, localDateString, addDaysToIsoDate };
