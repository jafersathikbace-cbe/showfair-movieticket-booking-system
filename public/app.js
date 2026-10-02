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
        Choose a theatre & showtime
      </h3>

      ${groupsHtml}
    `;


    catalogSection.hidden = true;
    movieDetail.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });


    $('#detail-back', movieDetail)
      .addEventListener('click', closeMovieDetail);


    $$('.showtime-chip', movieDetail)
      .forEach((chip) => {

        chip.addEventListener('click', () => {
          openBookingModal(chip.dataset.showId);
        });

      });
  }


  function closeMovieDetail() {
    movieDetail.hidden = true;
    catalogSection.hidden = false;
  }


  async function openBookingModal(showId) {

    resetModalState();

    state.showId = showId;

    modal.hidden = false;

    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    modalTitle.textContent = 'Select your seats';

    modalSubtitle.textContent =
      'Loading show details…';

    seatMapEl.innerHTML =
      '<p class="empty-state">Loading seat map…</p>';

    showStep('seats');


    try {

      const data =
        await api(
          `/api/show?id=${encodeURIComponent(showId)}`
        );


      state.showContext = {
        show: data.show,
        movie: data.movie,
        theatre: data.theatre
      };

      state.seatMap = data.seatMap;
      state.maxSeats = data.maxSeats;


      modalSubtitle.textContent =
        `${data.movie.title} · ` +
        `${data.theatre.name}, ${data.theatre.area} · ` +
        `${formatDateLong(data.show.date)} · ` +
        `${formatTime12(data.show.time)}`;


      renderSeatMap();
      updateSeatSummary();

    } catch (error) {

      seatMapEl.innerHTML = `
        <p class="empty-state">
          ${escapeHtml(error.message)}
        </p>
      `;

      showToast(error.message);
    }
  }


  function resetModalState() {

    stopHoldCountdown();

    state.selectedSeats = new Set();
    state.holdId = null;
    state.holdExpiresAt = null;
    state.holdAmount = null;

    holdBanner.hidden = true;

    seatErrorEl.hidden = true;
    checkoutError.hidden = true;

    checkoutForm.reset();

    holdBtn.disabled = true;
    holdBtn.textContent = 'Hold seats';
  }


  function renderSeatMap() {

    seatMapEl.innerHTML =
      state.seatMap.map((rowData) => `

        <div class="seat-row">

          <span class="row-label">
            ${escapeHtml(rowData.row)}
          </span>

          ${rowData.seats.map((seat) => `

            <button
              class="seat ${seat.tier === 'premium' ? 'is-premium' : ''}"
              data-seat-id="${escapeHtml(seat.id)}"
              data-price="${Number(seat.price)}"
              ${seat.status === 'occupied' ? 'disabled' : ''}
              aria-label="Seat ${escapeHtml(seat.id)}, ${escapeHtml(seat.status)}, ${rupees(seat.price)}"
              type="button">

              ${escapeHtml(seat.number)}

            </button>

          `).join('')}

        </div>

      `).join('');


    $$('.seat', seatMapEl)
      .forEach((button) => {

        if (button.disabled) {

          button.classList.add('is-occupied');

        } else {

          button.addEventListener(
            'click',
            () => toggleSeat(button)
          );
        }

      });
  }


  function toggleSeat(button) {

    const seatId = button.dataset.seatId;


    if (state.selectedSeats.has(seatId)) {

      state.selectedSeats.delete(seatId);

      button.classList.remove('is-selected');

    } else {

      if (state.selectedSeats.size >= state.maxSeats) {

        seatErrorEl.textContent =
          `You can select up to ${state.maxSeats} seats.`;

        seatErrorEl.hidden = false;

        return;
      }

      state.selectedSeats.add(seatId);

      button.classList.add('is-selected');
    }


    seatErrorEl.hidden = true;

    updateSeatSummary();
  }


  function previewTicketAmount() {

    return Array.from(state.selectedSeats)
      .reduce((total, id) => {

        const button =
          $(`.seat[data-seat-id="${CSS.escape(id)}"]`, seatMapEl);

        return total +
          (button ? Number(button.dataset.price) : 0);

      }, 0);
  }


  function updateSeatSummary() {

    const count = state.selectedSeats.size;

    selectedCountEl.textContent =
      count === 1
        ? '1 seat selected'
        : `${count} seats selected`;


    selectedAmountEl.textContent =
      count
        ? `Ticket subtotal ${rupees(previewTicketAmount())}`
        : '';


    holdBtn.disabled = count === 0;
  }


  async function holdSeats() {

    if (!state.selectedSeats.size) {
      return;
    }

    holdBtn.disabled = true;
    holdBtn.textContent = 'Holding…';


    try {

      const data =
        await api('/api/hold', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            showId: state.showId,
            seats: Array.from(state.selectedSeats)
          })
        });


      state.holdId = data.holdId;
      state.holdExpiresAt = data.expiresAt;
      state.holdAmount = data.amount;


      startHoldCountdown();

      renderCheckoutBreakdown();

      goToCheckout();


    } catch (error) {

      seatErrorEl.textContent = error.message;
      seatErrorEl.hidden = false;


      if (error.status === 409) {

        try {

          const fresh =
            await api(
              `/api/show?id=${encodeURIComponent(state.showId)}`
            );

          state.seatMap = fresh.seatMap;
          state.selectedSeats = new Set();

          renderSeatMap();
          updateSeatSummary();

        } catch (_) {}

      }

    } finally {

      holdBtn.disabled =
        state.selectedSeats.size === 0;

      holdBtn.textContent = 'Hold seats';
    }
  }


  function startHoldCountdown() {

    stopHoldCountdown();

    holdBanner.hidden = false;


    const tick = () => {

      const remaining =
        state.holdExpiresAt - Date.now();


      if (remaining <= 0) {

        stopHoldCountdown();

        holdTimerEl.textContent = '0:00';

        onHoldExpired();

        return;
      }


      const seconds =
        Math.ceil(remaining / 1000);


      holdTimerEl.textContent =
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };


    tick();

    state.holdTimerHandle =
      setInterval(tick, 1000);
  }


  function stopHoldCountdown() {

    if (state.holdTimerHandle) {
      clearInterval(state.holdTimerHandle);
    }

    state.holdTimerHandle = null;
  }


  function onHoldExpired() {

    holdBanner.hidden = true;

    state.holdId = null;
    state.holdAmount = null;
    state.selectedSeats = new Set();

    showToast(
      'Your seat hold expired. Please choose seats again.'
    );

    closeModal();
  }


  function goToCheckout() {

    modalTitle.textContent = 'Checkout';

    showStep('checkout');
  }


  function renderCheckoutBreakdown() {

    const amount = state.holdAmount;

    if (!amount) {
      return;
    }


    checkoutBreakdown.innerHTML = `

      <div class="pb-row">
        <span>Tickets (${state.selectedSeats.size})</span>
        <span>${rupees(amount.ticketAmount)}</span>
      </div>

      <div class="pb-row">
        <span>Convenience fee</span>
        <span>${rupees(amount.convenienceFee)}</span>
      </div>

      <div class="pb-row">
        <span>GST</span>
        <span>${rupees(amount.gst)}</span>
      </div>

      <div class="pb-total">
        <span>Total</span>
        <span>${rupees(amount.total)}</span>
      </div>

    `;
  }


  function releaseHold() {

    if (!state.holdId) {
      return;
    }

    const holdId = state.holdId;

    state.holdId = null;

    api('/api/release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        holdId
      })
    }).catch(() => {});
  }


  function backToSeats() {

    stopHoldCountdown();

    releaseHold();

    state.holdAmount = null;

    openBookingModal(state.showId);
  }


  async function submitCheckout(event) {

    event.preventDefault();

    checkoutError.hidden = true;

    const confirmBtn = $('#confirm-btn');

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirming…';


    const customer = {
      name: $('#cust-name').value.trim(),
      email: $('#cust-email').value.trim(),
      phone: $('#cust-phone').value.trim()
    };


    try {

      const booking =
        await api('/api/book', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            holdId: state.holdId,
            customer
          })
        });


      stopHoldCountdown();

      holdBanner.hidden = true;

      state.holdId = null;

      state.lastBooking = booking;

      renderConfirmation(booking);

      showStep('confirmation');


    } catch (error) {

      checkoutError.textContent =
        error.message;

      checkoutError.hidden = false;


      if (error.status === 410) {

        showToast(
          'Your hold expired. Please choose the seats again.'
        );
      }

    } finally {
