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
