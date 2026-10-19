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
6. From `uapb-yard/` (the CLI is a local npm dependency; no global install):
   ```
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules,firestore:indexes,database --project yard-game
   ```
   Put `VITE_FIREBASE_*` in `uapb-yard/.env.local` (gitignored). A copy in the parent folder is not read by Vite. Add the same keys in the Vercel project environment so production builds are not solo.
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
   count instead of "Solo mode", Sign up/Log in will work, and
   other signed-in players moving around will appear as other avatars.
9. Deploy the Cloud Functions — see [Cloud Functions](#cloud-functions)
   below. **Deploy these before inviting anyone:** they run the coin economy
   and the server-side moderation checks. Without them, chat and the
   corkboard still work, but only the in-browser filter checks posts, and a
   modified client can skip that.
10. Make yourself a moderator (see [Moderation](#moderation)).
11. Seed the store catalog once:
    ```
    npm install
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json npm run seed:store
    ```
    (Download a service account key from **Project Settings → Service
    accounts → Generate new private key** to get that JSON file.)

## Cost cap (Blaze + $300 credit through 2027-01-16)

Spark cannot run Cloud Functions. Blaze is pay as you go. This project is tuned to stay cheap:

- Functions: 256 MiB, 30s timeout, max 4 instances, **no min instances** (scale to zero).
- Stripe checkout is **not deployed** until you add Stripe secrets. Coin spend stays in Firestore.
- Set a Google Cloud billing budget so you get mail before the credit is gone. In Cloud Console: Billing → Budgets & alerts → $10/month, alert at 50%, 90%, 100%. A budget is an **alert**, not a hard shutoff. Turn off unused APIs (Maps, unused ML) in the GCP APIs list.

```
npx firebase-tools deploy --only functions:earnCoins,functions:spendCoins,functions:purchaseWithCoins,functions:onVoteWrite,functions:onRsvpWrite,functions:moderateChat,functions:moderateCorkboard,functions:moderateCandidate,functions:moderateParty,functions:moderateProfile,functions:onReportCreated,functions:resolveReport,functions:deleteMyAccount --project yard-game
```

## Cloud Functions

Clients can never write coin balances, inventory, purchases, or the earn
log: Firestore rules deny it outright (`allow write: if false`). Every change
goes through `functions/index.js`, which uses the Admin SDK.

**Economy**
- `earnCoins`: the client reports what happened (`source` plus a `grade` or
  `achievementId`), and the server decides the payout from
  `functions/gameRules.js`. It enforces per-source cooldowns, once-per-day
  rewards (band cheer, Lions Den), once-ever achievement bonuses, and a
  1,000-coin daily cap. The minigames themselves run in the browser, so the
  server can't prove a round was really won. These limits cap what a cheater
  can gain; they don't prevent cheating outright.
- `spendCoins`: whole-number amounts up to 1,000, checked against the
  balance.
- `purchaseWithCoins`: checks the balance, applies any `discountPct`, and
  grants the item and records the purchase in one transaction.
- `createCheckoutSession` / `stripeWebhook`: the Stripe flow, see below.

**Tallies**: `onVoteWrite` / `onRsvpWrite` keep `candidates.voteCount` and
`parties.rsvpCount` in sync. Firestore has no `GROUP BY`, so these replace
SQL views.

**Moderation**: `moderateChat`, `moderateCorkboard`, `moderateCandidate`,
`moderateParty`, `moderateProfile`, `onReportCreated`, `resolveReport`. See
[Moderation](#moderation).

**Privacy**: `deleteMyAccount` removes the account and everything it owns.

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
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`,
   then copy its signing secret:
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
Admin SDK that only that server-side function holds. The webhook only grants
sessions whose `payment_status` is `paid`, and grants each session exactly
once. Stripe retries webhook deliveries, so the purchase record is keyed by
session ID and checked inside the same transaction that grants.

**What's tested and what isn't:** the webhook (signature checks, paid and
unpaid sessions, retry replay, coin packs, and cosmetics) is covered by
`npm run test:emulator`, using signed test events. Creating a real Checkout
Session calls Stripe's API, so it needs your own Stripe test keys. Run one
test-mode purchase end to end before taking real payments.

## Moderation

Every public text field (chat, corkboard, nominee names, party titles, and
display names) goes through `functions/moderation.js`:

1. **In the browser, before posting.** The player gets an instant reason
   ("Links aren't allowed here", etc.).
2. **On the server, after posting.** Triggers re-run the same check and hide
   anything a modified client slipped past. Offensive display names are
   reset to "Golden Lion".

The filter blocks slurs, sexual content, strong profanity, self-harm
harassment ("kys"), links, phone numbers, and emails. It catches spacing and
leetspeak evasion ("f u c k", "n1gg3r") and is unit-tested against common
false positives ("summa cum laude", "class assignment", "Niger", "shiitake").
The word list is in one file; edit it to fit your community.

On top of the filter:

- **Rate limiting**: one public post every 3 seconds per player, enforced
  by Firestore rules, not just the UI.
- **Reports**: 🚩 on any message, post, nominee, or party. A player can
  report each item once, and anything reported by **3 different players is
  hidden immediately** until a moderator reviews it.
- **Moderator queue**: moderators see 🛡️ Moderation queue in their account
  menu, with Dismiss, Hide, Restore, and Hide + ban author. Bans block all
  posting (enforced by rules). Every action is recorded in `modLog`.
- **Hidden content is unreadable** to everyone except moderators (rules, not
  just UI filtering).

Make someone a moderator (they need to sign out and back in once):

```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json npm run set-admin -- you@example.com
```

Automated filtering never catches everything. Before inviting a real
student community, have at least one active moderator, and decide how
quickly reports will get reviewed.

## How identity works here

- **Sign up free / Log in** opens a lightweight auth modal with three
  options:
  - **Quick join** — anonymous Firebase auth, just pick a display name. No
    email, no password. Good enough to walk the Yard, post to the
    corkboard, and claim a plot.
  - **Email + password** — create an account or log in, with a "forgot
    password?" reset link.
  - **Google** — one-tap sign-in with an existing Google account. Only the
    first name from the Google profile is used by default, since display
    names are public.
- A `users/{uid}` Firestore document is created on first sign-in holding
  just a display name and a cosmetic color. Players can rename themselves
  and delete their account (and everything they've posted) from the account
  menu.
- Homecoming ballots are private. Only per-nominee totals are public.
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
