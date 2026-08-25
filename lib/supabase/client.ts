"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

/**
 * Browser client. Only ever used for auth (sign-in/out) and for pushing photo
 * bytes at a signed upload URL. It never reads family data — RLS gives the
 * anon role nothing, by design. See §1 of docs/supabase-integration.md.
 */
export function browserClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}
