# Turning on multiplayer

The game runs fine with no setup (single-player, local-only corkboard). To turn
on real accounts, presence (seeing other players move), the shared corkboard,
and Divine Nine plot claims, connect a free Supabase project:

1. Create a project at https://supabase.com (free tier is enough).
2. In your project: **Settings → API** — copy the **Project URL** and the
   **anon public** key.
3. In **Authentication → Providers**, make sure **Email** is enabled. For the
   passwordless magic-link flow, also turn on **Email OTP / Magic Link**
   under Authentication → Email templates (on by default for new projects).
4. In **SQL Editor → New query**, run each file in `supabase/migrations/`
   **in order** (001, 002, ...). Each one is additive — run a new one any
   time this repo adds another, you don't need to re-run old ones.
   - `001_init.sql` — `profiles`, `corkboard_posts`, `plot_claims`, RLS.
   - `002_economy.sql` — Yard Coin wallets, `earn_coins`/`spend_coins`
     functions (capped server-side so a client can't mint coins), and the
     `leaderboard_view`.
   - `003_voting.sql` — Homecoming King/Queen nominations, one vote per
     category per user, live tallies.
   - `004_membership.sql` — org membership rosters (one org per person) and
     Probate Night sign-ups. This only models the public, celebratory side
     of NPHC life — there is no pledge-process or ritual content anywhere
     in this app, by design.
   - `005_store.sql` — cosmetics and coin packs, with a starter catalog you
     can edit in the Supabase table editor. Coin-priced items purchase
     atomically server-side via `purchase_with_coins`.
   - `006_store_admin.sql` — a service-role-only function the Stripe
     webhook uses to grant coin packs after a real payment confirms.

## Turning on real-money purchases (Stripe)

Coin-priced cosmetics work the moment the migrations above are run — no
Stripe needed. Cash-priced coin packs need two more things, because a
Stripe secret key must never be shipped to the browser:

1. Install the Supabase CLI and log in (`supabase login`), then link this
   project: `supabase link --project-ref YOUR-PROJECT-REF`.
2. Create a [Stripe](https://stripe.com) account (test mode is fine to
   start), then set secrets and deploy the two Edge Functions in
   `supabase/functions/`:

   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set SITE_URL=https://your-deployed-site
   supabase functions deploy create-checkout-session

   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...   # Project Settings > API
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

3. In the Stripe dashboard, add a webhook endpoint pointing at the deployed
   `stripe-webhook` function's URL, listening for `checkout.session.completed`,
   then copy its signing secret:

   ```
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

Until this is done, the store's cash items show "Payments aren't set up
yet" instead of failing silently — coin-priced items are unaffected.

**What this app never does:** no card number is ever typed into or handled
by this app's own code — Stripe Checkout is a Stripe-hosted page. No secret
key is ever in client code. Coin grants from a real payment only happen
inside the webhook, authenticated by Stripe's signature, using the
service-role key that only that server-side function holds.
5. In the `uapb-yard/` folder, create a file named `.env.local`:

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

6. Restart the dev server (`npm run dev`). The topbar will show live player
   count instead of the static placeholder, Sign up/Log in will work, and
   other signed-in players moving around will appear as other avatars.

## How identity works here

- **Sign up free / Log in** opens a lightweight auth modal with two options:
  - **Quick join** — anonymous Supabase auth (`signInAnonymously`), just pick
    a display name. No email, no password. Good enough to walk the Yard,
    post to the corkboard, and claim a plot.
  - **Email magic link** — passwordless; Supabase emails a sign-in link.
    No password is ever typed or stored by this app.
- A `profiles` row is created on first sign-in holding just a display name
  and a cosmetic color.
- Position/rotation are **not** persisted to the database — they're only
  broadcast live over a Supabase Realtime **presence** channel while you're
  on the page, so there's no location history stored anywhere.
