# The Yard — UAPB

A 3D homecoming-themed campus game built on the real University of Arkansas
at Pine Bluff campus (positions sourced from OpenStreetMap), with nostalgia
minigames, real weather/day-night, and optional Firebase-backed multiplayer,
accounts, and an economy.

## Run it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Works fully single-player out of the box —
no setup required.

## Turning on multiplayer, accounts, voting, the store, etc.

All of that is optional and backed by a free Firebase project. See
[`firebase/README.md`](firebase/README.md) for setup. Until it's configured,
every online feature shows a clear "connect Firebase" message instead of
failing silently.

## Install as an app

The site is an installable PWA — on a phone, use the browser's "Add to Home
Screen" (iOS) or the install prompt (Android/Chrome) to get an app icon with
no browser chrome. A touch D-pad and interact button appear automatically on
touch devices.

## Sharing / link previews

`index.html` has Open Graph and Twitter Card tags pointing at `/og-image.png`
for a clean preview when the link is shared. They use relative paths, which
work for most crawlers once deployed — but once you have a real domain,
change `og:image` / `twitter:image` to the full absolute URL
(`https://yourdomain.com/og-image.png`) for maximum compatibility, since a
few platforms don't resolve relative image URLs correctly.

## Project layout

- `src/main.js` — scene setup, campus generation, avatar/camera, input,
  minigame modal routing.
- `src/buildings.js` — detailed building models for the researched/popular
  campus buildings (Bell Tower, Student Union, Library, Caldwell Hall-style
  academic halls, dorms, the stadium).
- `src/campusData.js` — real building positions (from OpenStreetMap) and
  fictional/supplementary additions, clearly labeled.
- `src/minigames/` — each minigame/modal (cards, dominoes, pager, cookout,
  step show, store, voting, parties, etc.) as its own module.
- `src/weather.js`, `src/seasonal.js` — live weather/day-night and date-gated
  seasonal events.
- `src/auth.js`, `src/multiplayer.js`, `src/economy.js`, `src/firebase.js` —
  the Firebase-backed layer; all degrade gracefully when unconfigured.
- `firestore.rules`, `firestore.indexes.json`, `database.rules.json` — the
  Firestore/Realtime Database security rules and indexes.
- `functions/` — Cloud Functions: the coin-economy transactions and Stripe
  Checkout, deployed with `firebase deploy --only functions`.
- `scripts/seedStoreItems.mjs` — one-off Admin SDK script that seeds the
  store catalog (Firestore has no client write policy on `storeItems`).
