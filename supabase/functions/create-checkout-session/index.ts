// Supabase Edge Function — creates a Stripe Checkout Session for a store
// item priced in real money (price_cents). The Stripe secret key never
// reaches the client: it only exists here, as a function secret.
//
// Deploy: supabase functions deploy create-checkout-session
// Secrets:  supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//           supabase secrets set SITE_URL=https://your-deployed-site
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("missing auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error("not authenticated");

    const { item_id } = await req.json();
    const { data: item, error: itemError } = await supabase
      .from("store_items")
      .select("*")
      .eq("id", item_id)
      .eq("active", true)
      .single();
    if (itemError || !item) throw new Error("item not found");
    if (!item.price_cents) throw new Error("this item is not cash-priced");

    const chargeCents = item.discount_pct
      ? Math.round(item.price_cents * (1 - item.discount_pct / 100))
      : item.price_cents;

    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: chargeCents,
            product_data: { name: item.name },
          },
          quantity: 1,
        },
      ],
      metadata: { user_id: userData.user.id, item_id: item.id },
      success_url: `${siteUrl}/?purchase=success`,
      cancel_url: `${siteUrl}/?purchase=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
