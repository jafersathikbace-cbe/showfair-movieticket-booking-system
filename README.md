# ShowFair — Tamil Cinema

A focused Tamil movie showtime and seat-booking demo for Coimbatore.

ShowFair lets a visitor:

- browse **Tamil movies only**
- switch between **today and the next four days**
- see Coimbatore theatres and showtimes
- inspect a live 8×10 seat map
- hold seats on the server for 7 minutes
- see the complete ticket + convenience fee + GST breakdown before confirmation
- receive a booking code
- look up bookings by email
- cancel an eligible booking and see the refund amount

The movies, theatres, schedules, and poster artwork are **fictional demo content**.

## What was fixed in the Tamil-cinema refresh

The original demo had several content and lifecycle problems:

1. **Stale show dates** — the original data was fixed to September 25, 2026, so it became outdated. Shows now use relative demo dates.
2. **Mixed-language catalog** — English and Hindi filters/content were removed. The catalog is now Tamil-only.
3. **External poster dependency** — remote placeholder posters were replaced with local SVG artwork.
4. **Client-side checkout calculation** — the server now calculates the price breakdown when the seat hold is created; checkout displays that server result.
5. **Past-show booking** — the API now rejects shows that have already started.
6. **Timezone ambiguity** — show dates and cancellation cutoffs use India Standard Time (Asia/Kolkata).
7. **Stale browser assets after deployment** — local HTML/CSS/JS assets are served with `no-cache`.
8. **Deployment security** — baseline CSP and Permissions-Policy headers were added.

## Run locally

Requires Node.js 16+.

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Useful commands:

```bash
npm test
npm run check
node scripts/reset-demo-data.js
```

`npm install` has no third-party runtime dependencies; the application uses Node's built-in HTTP, filesystem, URL, and crypto modules.

## Project structure

```text
showfair/
├── public/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── posters/             # local fictional Tamil-film poster artwork
├── src/
│   ├── booking.js            # booking codes + India-time show/cancellation rules
│   ├── config.js             # runtime + pricing configuration
│   ├── pricing.js            # seat pricing + fee calculation
│   ├── seats.js              # seat inventory + hold occupancy
│   ├── store.js              # JSON datastore + rolling demo dates
│   └── validation.js         # customer + seat validation
├── test/                     # Node test suite
├── scripts/
├── data/store.json           # fictional Tamil catalog + demo booking state
├── server.js
└── README.md
```

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/catalog?date=YYYY-MM-DD` | Tamil movies and shows for a selected date |
| GET | `/api/show?id=SHOW_ID` | Show details and live seat map |
| POST | `/api/hold` | Hold selected seats for 7 minutes |
| POST | `/api/book` | Confirm a held selection |
| GET | `/api/bookings?email=EMAIL` | Look up bookings |
| POST | `/api/cancel` | Cancel an eligible booking |
| POST | `/api/release` | Release a seat hold |

## Rolling demo schedule

Show records use `dayOffset` instead of a hard-coded calendar date:

- `0` = today in India
- `1` = tomorrow
- `2` = two days from today
- etc.

This keeps the demo populated when it is deployed for a long time.

Only shows that have **not already started** are returned for the selected date.

## Seat booking flow

1. The browser requests a fresh seat map from `/api/show`.
2. The server checks seeded occupied seats, confirmed bookings, and active holds.
3. The server creates a seven-minute hold.
4. The server calculates:
   - ticket amount
   - premium-seat surcharge
   - convenience fee
   - GST
   - total
5. The checkout screen displays that server-calculated object.
6. `/api/book` re-checks the hold and seat availability before confirming.
7. The hold is removed when the booking is confirmed.

The current seat inventory is an 8×10 grid. Rows A–B are premium seats.

## Pricing

The demo uses:

```text
Premium seat = base show price + ₹40
Convenience fee = 6% of ticket amount
GST = 18% of ticket amount + convenience fee
Total = ticket amount + convenience fee + GST
```

Each fee is rounded independently on the server.

## Cancellation

A confirmed booking gets a cancellation cutoff of:

```text
booking time + 2.5 hours
```

capped at the show's start time.

The API uses India Standard Time when interpreting show dates/times. If cancellation is still allowed, the booking page exposes the cancellation action and the full demo amount is marked as refunded after cancellation.

## Tests

The project uses Node's built-in test runner:

```bash
npm test
npm run check
```

The suite covers:

- pricing and fee rounding
- premium seats
- seat occupancy and expired holds
- booking identifiers
- India-time cancellation cutoff
- customer validation
- security headers
- static file serving
- Tamil-only catalog
- rolling show dates
- future-date catalog selection

## Demo limitations

This is still a portfolio/demo application, not a production ticketing platform.

It intentionally uses:

- a JSON file instead of PostgreSQL
- no customer authentication
- email-only booking lookup
- simulated payment
- a single-process server
- no payment gateway/webhooks

For a real deployment, use a transactional database, authenticated accounts, idempotent booking requests, rate limiting, real payment processing, and multi-instance-safe seat locking.

## Render deployment

Render can run the same Node server with:

```text
Build Command: npm install
Start Command: npm start
```

The application listens on the `PORT` environment variable supplied by Render.

After pushing changes to the connected GitHub repository, Render should redeploy the new commit automatically if auto-deploy is enabled.
