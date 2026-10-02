(function () {
  'use strict';

  const state = {
    catalog: null,
    selectedDate: null,
    activeMovie: null,
    showId: null,
    showContext: null,
    seatMap: null,
    maxSeats: 8,
    selectedSeats: new Set(),
    holdId: null,
    holdExpiresAt: null,
    holdAmount: null,
    holdTimerHandle: null,
    lastBooking: null
  };

  const $ = (selector, root) =>
    (root || document).querySelector(selector);

  const $$ = (selector, root) =>
    Array.from((root || document).querySelectorAll(selector));


  const viewHome = $('#view-home');
  const viewBookings = $('#view-bookings');

  const movieGrid = $('#movie-grid');
  const movieDetail = $('#movie-detail');
  const catalogSection = $('#catalog-section');

  const dateTabs = $('#date-tabs');
  const showCount = $('#show-count');

  const modal = $('#booking-modal');
  const modalTitle = $('#modal-title');
  const modalSubtitle = $('#modal-subtitle');

  const stepSeats = $('#step-seats');
  const stepCheckout = $('#step-checkout');
  const stepConfirmation = $('#step-confirmation');

  const seatMapEl = $('#seat-map');
  const holdBanner = $('#hold-banner');
  const holdTimerEl = $('#hold-timer');

  const selectedCountEl = $('#selected-count');
  const selectedAmountEl = $('#selected-amount');

  const holdBtn = $('#hold-btn');
  const seatErrorEl = $('#seat-error');

  const checkoutForm = $('#checkout-form');
  const checkoutBreakdown = $('#checkout-breakdown');
  const checkoutError = $('#checkout-error');

  const bookingsList = $('#bookings-list');
  const lookupEmail = $('#lookup-email');
  const lookupBtn = $('#lookup-btn');

  const toastEl = $('#toast');


  function rupees(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
  }


  /*
   * Convert 24-hour backend time into AM/PM display.
   *
   * Examples:
   * 09:45 -> 9:45 AM
   * 12:00 -> 12:00 PM
   * 15:00 -> 3:00 PM
   * 21:15 -> 9:15 PM
   */
  function formatTime12(time) {
    if (!time || !/^\d{1,2}:\d{2}$/.test(time)) {
      return time || '';
    }

    let [hours, minutes] = time.split(':').map(Number);

    const suffix = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;

    if (hours === 0) {
      hours = 12;
    }

    return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }


  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }


  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;

    clearTimeout(showToast._timer);

    showToast._timer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3800);
  }


  async function api(path, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    try {
      const response = await fetch(path, {
        ...options,
        signal: controller.signal
      });

      let data = {};

      try {
        data = await response.json();
      } catch (_) {
        data = {};
      }

      if (!response.ok) {
        const error = new Error(
          data.error ||
          'Something went wrong. Please try again.'
        );

        error.status = response.status;
        error.payload = data;

        throw error;
      }

      return data;

    } finally {
      clearTimeout(timeout);
    }
  }


  function setNavActive(view) {
    $$('.nav-link').forEach((button) => {
      button.classList.toggle(
        'is-active',
        button.dataset.nav === view
      );
    });
  }


  function showView(view) {
    const isHome = view === 'home';

    viewHome.hidden = !isHome;
    viewBookings.hidden = isHome;

    setNavActive(view);

    if (isHome) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }


  function formatDateLong(iso) {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(
      new Date(`${iso}T12:00:00+05:30`)
    );
  }


  function renderDateTabs() {
    const dates =
      state.catalog &&
      state.catalog.availableDates
        ? state.catalog.availableDates
        : [];

    dateTabs.innerHTML = dates.map((item, index) => `
      <button
        class="date-tab ${item.date === state.selectedDate ? 'is-active' : ''}"
        data-date="${escapeHtml(item.date)}"
        role="tab"
        aria-selected="${item.date === state.selectedDate}"
        type="button">

        <span>
          ${
            index === 0
              ? 'Today'
              : index === 1
                ? 'Tomorrow'
                : escapeHtml(item.label.split(',')[0])
          }
        </span>

        <strong>
          ${escapeHtml(item.label.split(' ').slice(-2).join(' '))}
        </strong>

      </button>
    `).join('');

    $$('.date-tab', dateTabs).forEach((tab) => {

      tab.addEventListener('click', async () => {

        if (tab.dataset.date === state.selectedDate) {
          return;
        }

        state.selectedDate = tab.dataset.date;

        renderDateTabs();

        await loadCatalog(state.selectedDate);
      });

    });
  }


  async function loadCatalog(date) {
    movieGrid.innerHTML =
      '<p class="loading-text">Loading Tamil shows…</p>';

    try {
      const query = date
        ? `?date=${encodeURIComponent(date)}`
        : '';

      const data = await api(`/api/catalog${query}`);

      state.catalog = data;
      state.selectedDate = data.selectedDate;

      renderDateTabs();
      renderMovies();

    } catch (error) {

      movieGrid.innerHTML = `
        <p class="empty-state">
          ${escapeHtml(error.message)}
        </p>
      `;
    }
  }


  function renderMovies() {
    const movies =
      state.catalog.movies.filter(
        (movie) => movie.shows.length > 0
      );

    const totalShows =
      movies.reduce(
        (sum, movie) => sum + movie.shows.length,
        0
      );

    showCount.textContent =
      `${totalShows} show${totalShows === 1 ? '' : 's'} · ${formatDateLong(state.selectedDate)}`;


    if (!movies.length) {

      movieGrid.innerHTML = `
        <div class="empty-panel">
          <strong>No Tamil shows on this date.</strong>
          <span>Try another date above.</span>
        </div>
      `;

      return;
    }


    movieGrid.innerHTML = movies.map((movie) => {

      const times = movie.shows
        .map((show) => formatTime12(show.time))
        .join(' · ');

      return `
        <button
          class="movie-card"
          data-movie-id="${escapeHtml(movie.id)}"
          type="button">

          <img
            class="movie-poster"
            src="${escapeHtml(movie.poster)}"
            alt="${escapeHtml(movie.title)} poster"
            loading="lazy" />

          <div class="movie-card-body">

            <div class="movie-card-top">
              <span class="genre-pill">
                ${escapeHtml(movie.genre)}
              </span>

              <span>
                ${escapeHtml(movie.rating)}
              </span>
            </div>

            <div class="movie-title">
              ${escapeHtml(movie.title)}
            </div>

            <div class="movie-meta">
              ${escapeHtml(movie.duration)}
              ·
              ${movie.shows.length}
              show${movie.shows.length === 1 ? '' : 's'}
            </div>

            <div class="movie-times">
              ${escapeHtml(times)}
            </div>

            <div class="movie-card-action">
              View theatres <span>→</span>
            </div>

          </div>

        </button>
      `;

    }).join('');


    $$('.movie-card', movieGrid).forEach((card) => {

      card.addEventListener('click', () => {
        openMovieDetail(card.dataset.movieId);
      });

    });
  }


  function openMovieDetail(movieId) {

    const movie =
      state.catalog.movies.find(
        (item) => item.id === movieId
      );

    if (!movie || !movie.shows.length) {
      return;
    }

    state.activeMovie = movie;

    const theatreGroups = {};

    movie.shows.forEach((show) => {

      if (!theatreGroups[show.theatreId]) {

        theatreGroups[show.theatreId] = {
          name: show.theatreName,
          area: show.area,
          screen: show.screen,
          facilities: show.facilities,
          shows: []
        };
      }

      theatreGroups[show.theatreId].shows.push(show);

    });


    const groupsHtml =
      Object.values(theatreGroups).map((group) => `

        <div class="theatre-group">

          <div class="theatre-group-header">

            <div>
              <h3>${escapeHtml(group.name)}</h3>

              <span>
                ${escapeHtml(group.area)}
                ·
                ${escapeHtml(group.screen)}
              </span>
            </div>

            <span class="facility-line">
              ${group.facilities.map(escapeHtml).join(' · ')}
            </span>

          </div>


          <div class="showtime-list">

            ${group.shows.map((show) => `

              <button
                class="showtime-chip"
                data-show-id="${escapeHtml(show.id)}"
                type="button">

                <span class="showtime-main">
                  ${escapeHtml(formatTime12(show.time))}
                </span>

                <span class="fmt">
                  ${escapeHtml(show.format)}
                </span>

                <span class="price">
                  from ${rupees(show.price)}
                </span>

              </button>

            `).join('')}

          </div>

        </div>

      `).join('');


    movieDetail.innerHTML = `

      <button
        class="movie-detail-back"
        id="detail-back"
        type="button">
        ← Back to Tamil movies
      </button>


      <div class="movie-detail-card">

        <img
          src="${escapeHtml(movie.poster)}"
          alt="${escapeHtml(movie.title)} poster" />

        <div class="movie-detail-info">

          <p class="section-kicker">
            ${escapeHtml(movie.genre)}
            ·
            ${escapeHtml(movie.duration)}
          </p>

          <h2>
            ${escapeHtml(movie.title)}
          </h2>

          <div class="movie-tags">

            <span class="tag tag-rating">
              ${escapeHtml(movie.rating)}
            </span>

            ${movie.formats.map((format) => `
              <span class="tag">
                ${escapeHtml(format)}
              </span>
            `).join('')}

          </div>

          <p class="description">
            ${escapeHtml(movie.description)}
          </p>

          <div class="detail-date">
            ${formatDateLong(state.selectedDate)}
          </div>

        </div>

      </div>


      <h3 class="showtimes-heading">
