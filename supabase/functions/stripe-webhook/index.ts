// Supabase Edge Function — Stripe webhook. Verifies the signature, and on
// checkout.session.completed grants the purchased item (coin pack balance
// or cosmetic inventory row) using the service-role key, which only ever
// runs here, never in the browser.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// In the Stripe dashboard, point a webhook at this function's URL for the
// checkout.session.completed event, then:
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...  (Project Settings > API)
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const itemId = session.metadata?.item_id;
    if (!userId || !itemId) {
      return new Response("missing metadata", { status: 400 });
    }

    const { data: item } = await supabaseAdmin.from("store_items").select("*").eq("id", itemId).single();
    if (!item) return new Response("item not found", { status: 404 });

    await supabaseAdmin.from("purchases").insert({
      user_id: userId,
      item_id: itemId,
      provider: "stripe",
      price_paid_cents: item.price_cents,
      stripe_session_id: session.id,
    });

    if (item.kind === "coin_pack") {
      const coinAmount = item.meta?.coins ?? Math.round((item.price_cents ?? 0) * 2.5); // fallback rate
      // admin_grant_coins (006_store_admin.sql) is service-role-only and
      // takes an explicit user id, unlike earn_coins which trusts auth.uid().
      await supabaseAdmin.rpc("admin_grant_coins", {
        p_user_id: userId,
        amount: coinAmount,
        reason: "store: " + item.name,
      });
    } else {
      await supabaseAdmin.from("inventory").upsert({ user_id: userId, item_id: itemId });
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
