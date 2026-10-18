# Turning on multiplayer

The game runs fine with no setup (single-player, local-only corkboard). To
turn on real accounts, presence (seeing other players move), the shared
corkboard, and Divine Nine plot claims, connect a free Firebase project:

1. Create a project at https://console.firebase.google.com (free Spark plan
   is enough to start; Cloud Functions need the pay-as-you-go Blaze plan,
   which still has a generous free tier).
2. In the Firebase console, add a **Web app** to the project (</>  icon on
   the project overview page) and copy the config values it gives you.
3. In **Build → Authentication → Sign-in method**, enable:
   - **Anonymous** — powers "Quick join" (no email, no password).
   - **Email/Password** — powers the email + password tab, including
     "Forgot password?".
   - **Google** — powers "Continue with Google".
4. In **Build → Firestore Database**, create a database (any region; pick
   one close to your players — Cloud Functions below should run in the same
   region).
5. In **Build → Realtime Database**, create a database. This is separate
   from Firestore and is only used for live player positions (presence).
6. Install the Firebase CLI (`npm install -g firebase-tools`), run
   `firebase login`, then from this project's root:
   ```
   firebase use --add        # pick your project, alias it "default"
   firebase deploy --only firestore:rules,firestore:indexes,database
   ```
7. In the `uapb-yard/` folder, create a file named `.env.local` from
   `.env.example`, filling in the Web app config values from step 2:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_DATABASE_URL=...   # the Realtime Database URL from step 5
   ```
8. Restart the dev server (`npm run dev`). The topbar will show live player
   count instead of the static placeholder, Sign up/Log in will work, and
   other signed-in players moving around will appear as other avatars.
9. Deploy the Cloud Functions (coin economy + Stripe) — see
   [Cloud Functions](#cloud-functions-coin-economy) below. Voting, parties,
   plot claims, and the corkboard work without them; the **store** and
   **vending machine** need `earnCoins`/`spendCoins`/`purchaseWithCoins`
   deployed first.
10. Seed the store catalog once:
    ```
    npm install
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json npm run seed:store
    ```
    (Download a service account key from **Project Settings → Service
    accounts → Generate new private key** to get that JSON file.)

## Cloud Functions (coin economy)

The old "a client can never write its own coin balance" guarantee — enforced
in Postgres by `SECURITY DEFINER` functions — is now enforced by Firestore
rules that make `wallets`, `walletTransactions`, `inventory`, and
`purchases` entirely unwritable by clients (`allow write: if false`), with
every mutation going through `functions/index.js`'s callable functions using
the Admin SDK, which bypasses those rules by design:

- `earnCoins` — capped at 250 per call (same cap the old SQL function had).
- `spendCoins` — checks balance server-side before deducting.
- `purchaseWithCoins` — the coin-priced store flow: checks balance, applies
  any `discountPct`, grants inventory + records the purchase atomically.
- `createCheckoutSession` / `stripeWebhook` — the Stripe flow, see below.
- `onVoteWrite` / `onRsvpWrite` — Firestore triggers that keep
  `candidates.voteCount` and `parties.rsvpCount` in sync (Firestore has no
  `GROUP BY`, so these replace the old `candidate_tallies`/`party_tallies`
  SQL views).

Deploy all of them with:
```
cd functions && npm install && cd ..
firebase deploy --only functions
```

## Turning on real-money purchases (Stripe)

Coin-priced cosmetics work the moment `purchaseWithCoins` is deployed — no
Stripe needed. Cash-priced coin packs need Stripe secrets, because a Stripe
secret key must never be shipped to the browser:

1. Create a [Stripe](https://stripe.com) account (test mode is fine to
   start).
2. Set the Stripe secret key, and optionally your deployed site's URL
   (defaults to `http://localhost:5173` otherwise — set it once you have a
   real domain), then deploy:
   ```
   firebase functions:secrets:set STRIPE_SECRET_KEY
   echo "SITE_URL=https://your-deployed-site" > functions/.env
   firebase deploy --only functions:createCheckoutSession,functions:stripeWebhook
   ```
3. In the Stripe dashboard, add a webhook endpoint pointing at the deployed
   `stripeWebhook` function's URL (shown after deploy), listening for
   `checkout.session.completed`, then copy its signing secret:
   ```
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   firebase deploy --only functions:stripeWebhook
   ```

Until this is done, the store's cash items show "Payments aren't set up
yet" instead of failing silently — coin-priced items are unaffected.

**What this app never does:** no card number is ever typed into or handled
by this app's own code — Stripe Checkout is a Stripe-hosted page. No secret
key is ever in client code. Coin grants from a real payment only happen
inside `stripeWebhook`, authenticated by Stripe's signature, using the
Admin SDK that only that server-side function holds.

## How identity works here

- **Sign up free / Log in** opens a lightweight auth modal with three
  options:
  - **Quick join** — anonymous Firebase auth, just pick a display name. No
    email, no password. Good enough to walk the Yard, post to the
    corkboard, and claim a plot.
  - **Email + password** — create an account or log in, with a "forgot
    password?" reset link.
  - **Google** — one-tap sign-in with an existing Google account.
- A `users/{uid}` Firestore document is created on first sign-in holding
  just a display name and a cosmetic color.
- Position/rotation are **not** persisted anywhere — they're only broadcast
  live over a Realtime Database `presence/{uid}` node while you're on the
  page, and automatically removed (`onDisconnect`) if your tab closes or
  your connection drops, so there's no location history stored anywhere.

## Weather and day/night

No setup needed — `src/weather.js` pulls live conditions for Pine Bluff, AR
from [Open-Meteo](https://open-meteo.com) (free, keyless), refreshed every
15 minutes. Day/night and sky dimming follow the real local time and
weather (rain/snow spawn particles, fog tightens the view distance, storms
dim things further). The Night Mode chip is a manual override; it's
overwritten by the next real-weather refresh unless you leave it alone.
