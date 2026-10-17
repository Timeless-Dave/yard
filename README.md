# The Yard — UAPB

A 3D homecoming-themed campus game built on the real University of Arkansas
at Pine Bluff campus (positions sourced from OpenStreetMap), with nostalgia
minigames, real weather/day-night, and optional Supabase-backed multiplayer,
accounts, and an economy.

## Run it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Works fully single-player out of the box —
no setup required.

## Turning on multiplayer, accounts, voting, the store, etc.

All of that is optional and backed by a free Supabase project. See
[`supabase/README.md`](supabase/README.md) for setup. Until it's configured,
every online feature shows a clear "connect Supabase" message instead of
failing silently.

## Install as an app

The site is an installable PWA — on a phone, use the browser's "Add to Home
Screen" (iOS) or the install prompt (Android/Chrome) to get an app icon with
no browser chrome. A touch D-pad and interact button appear automatically on
touch devices.

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
- `src/auth.js`, `src/multiplayer.js`, `src/economy.js`, `src/supabase.js` —
  the Supabase-backed layer; all degrade gracefully when unconfigured.
- `supabase/migrations/` — run in order in the Supabase SQL Editor to turn on
  the backend. `supabase/functions/` — Stripe Checkout Edge Functions.
