import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Anonymous writes allowed per family, per actor, per hour. See §2.5. */
export const RATE_LIMIT_PER_HOUR = 60;

export class RateLimitError extends Error {
  constructor() {
    super("Too many edits from here in the last hour. Try again later.");
  }
}

/**
 * A stable per-visitor fingerprint that is not a raw IP.
 *
 * Raw IPs are personal data under GDPR and Indonesia's UU PDP, and nothing here
 * needs to reverse the value — only to compare it. Rotating EDIT_ACTOR_SALT
 * simply resets every rate-limit bucket.
 */
export async function hashActor(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const ua = h.get("user-agent") ?? "unknown";
  const salt = process.env.EDIT_ACTOR_SALT;
  if (!salt) throw new Error("EDIT_ACTOR_SALT is not set");

  return createHash("sha256").update(`${ip}\n${ua}\n${salt}`).digest("hex");
}

/**
 * Counts recent rows in person_edits rather than keeping a throttle table —
 * person_edits_throttle_idx covers exactly this query.
 *
 * Signed-in owners are exempt: they can already do far more damage through the
 * settings page, and locking a family's owner out of their own tree to slow
 * down a stranger is the wrong trade.
 */
export async function assertUnderRateLimit(
  db: SupabaseClient,
  familyId: string,
  actorHash: string,
  actorId: string | null,
): Promise<void> {
  if (actorId) return;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from("person_edits")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("actor_hash", actorHash)
    .gte("created_at", since);

  if (error) throw error;
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) throw new RateLimitError();
}
