# Changelog

## 1.1.0 — Tamil cinema refresh

- Reworked the catalog into a Tamil-only Coimbatore cinema demo.
- Added five-day date selection with relative demo scheduling so shows do not become stale after deployment.
- Added six fictional Tamil movie titles, Coimbatore theatres, showtimes, and local poster artwork.
- Removed English/Hindi language filters that did not match the product goal.
- Moved checkout price-breakdown authority to the server-side seat hold response.
- Added show-start validation so already-started shows cannot be booked.
- Added India-timezone handling for show dates and cancellation cutoffs.
- Added local poster assets so the UI does not depend on external image hosts.
- Added stronger browser security headers and disabled stale static-asset caching.
- Improved movie, showtime, booking, and confirmation content for the Tamil-cinema use case.

## 1.0.0 — ShowFair demo

- Added movie catalogue and showtime browsing.
- Added server-side seat availability and seven-minute holds.
- Added backend-computed ticket, convenience fee, GST, and total amounts.
- Added booking confirmation and cancellation cutoff handling.
- Added modular pricing, seat, validation, booking, and datastore rules.
- Added automated unit and HTTP smoke tests.
- Added CI, security headers, health checks, and demo reset tooling.
