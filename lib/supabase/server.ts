import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";

/**
 * Session-bound client for Server Components and Server Actions. Reads and
 * writes the auth cookie, so it answers "who is logged in" and is subject to
 * the owner RLS policies.
 */
export async function sessionClient() {
  // Next 16: cookies() is async.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session, so this is safe to swallow.
        }
      },
    },
  });
}

/** The signed-in user, or null. */
export async function currentUser() {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}
