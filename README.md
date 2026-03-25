# Train Ticket Watcher

This project checks Bangladesh Railway ticket availability for only `TURNA (742)` and only `S_CHAIR`, then sends a Telegram alert when seats appear.

## What it checks

- `FROM_CITY=Dhaka`
- `TO_CITIES=Feni,Chattogram`
- `JOURNEY_DATE=26-Mar-2026`
- `SEAT_CLASS=S_CHAIR`

All of these stay configurable from `.env`.

## Why this is safe for the request limit

The watcher checks destinations one by one and waits between requests. With the default config:

- each URL is checked once per cycle
- there is `8` seconds spacing between destination requests
- there is `45` seconds wait before the next cycle

That keeps the same search URL well below the "10 requests within 1 minute" limit.

## First-time setup

1. Run `npm install`
2. Run `npm run setup-login`
3. In the normal Chrome window that opens, log in to the railway site if needed
4. Keep that Chrome window open
5. Run `npm run watch`

## Useful commands

- `npm run start-browser` opens the dedicated Chrome profile again if you need it later
- `npm run setup-login` opens a persistent browser profile and lets you save the railway login once
- `npm run check-once` runs one availability check cycle
- `npm run watch` keeps checking in a loop
- `npm run test-telegram` sends a Telegram test message

## Notes

- Notification is sent when availability becomes positive or changes while still positive.
- Current parser is written specifically for `TURNA (742)` and `S_CHAIR`.
- The saved login profile lives in `state/runtime-profile`.
- The watcher attaches to the already-open Chrome using `CDP_PORT=9222`.
