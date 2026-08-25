import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseEnv } from "./env";

/**
 * Service-role client: bypasses RLS entirely.
 *
 * This is what makes the slug work as a capability. RLS cannot see a URL, so
 * public read/write flows through Server Actions that validate the slug
 * themselves and then use this client. It must never reach the browser —
 * `server-only` turns a stray client import into a build error rather than a
 * leaked key.
 */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const MEDIA_BUCKET = "family-media";
