import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const ONLINE = Boolean(url && anonKey);

export const supabase = ONLINE
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

if (!ONLINE) {
  console.warn(
    "[The Yard] No Supabase credentials found (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). " +
      "Running in offline/single-player demo mode — see supabase/README.md to turn on multiplayer."
  );
}
