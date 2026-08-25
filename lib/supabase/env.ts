/**
 * The two public Supabase vars, checked once. `process.env.X!` only silences
 * TypeScript — at runtime a missing var reaches the SDK as `undefined` and
 * surfaces as "supabaseUrl is required", which says nothing about the cause.
 *
 * No "server-only"/"use client" marker: both sides import this. The literal
 * `process.env.NEXT_PUBLIC_*` reads are what Next inlines into the browser
 * bundle, so they must stay literal.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. " +
        "Copy .env.local.example to .env.local — `supabase start` prints both.",
    );
  }

  return { url, anonKey };
}
