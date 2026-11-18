import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Anonymous writes allowed per family, per actor, per hour. See §2.5. */
export const RATE_LIMIT_PER_HOUR = 60;
/** Signed-in actors, counted per account: room to enter a whole tree, not unlimited. */
export const SIGNED_IN_RATE_LIMIT_PER_HOUR = 600;

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
  // Cloudflare sets cf-connecting-ip, overwriting any copy the client sent, and
  // the origin only takes traffic from Cloudflare. Failing that, the LAST
  // X-Forwarded-For hop is the one a proxy appended; the first is whatever the
  // client typed. No user agent: it is client-chosen, so it only split buckets.
  const ip =
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown";
  const salt = process.env.EDIT_ACTOR_SALT;
  if (!salt) throw new Error("EDIT_ACTOR_SALT is not set");

  return createHash("sha256").update(`${ip}\n${salt}`).digest("hex");
}

// Upload tokens leave no person_edits row, so they are counted here.
// ponytail: per-process memory, reset on restart and not shared between
// instances. Fine for the single `next start` on the VPS; move it to a table
// if the app ever runs as more than one process.
const uploadTokens = new Map<string, number[]>();
const HOUR_MS = 60 * 60 * 1000;

const bucketOf = (familyId: string, actorHash: string, actorId: string | null) =>
  `${familyId}:${actorId ?? actorHash}`;

function recentUploadTokens(bucket: string, since: number): number {
  const kept = (uploadTokens.get(bucket) ?? []).filter((t) => t >= since);
  if (kept.length) uploadTokens.set(bucket, kept);
  else uploadTokens.delete(bucket);
  return kept.length;
}

/** Charge a minted upload token to the same bucket assertUnderRateLimit checks. */
export function noteUploadToken(familyId: string, actorHash: string, actorId: string | null): void {
  const bucket = bucketOf(familyId, actorHash, actorId);
  uploadTokens.set(bucket, [...(uploadTokens.get(bucket) ?? []), Date.now()]);
  // Buckets are otherwise only pruned when their own actor comes back.
  if (uploadTokens.size > 10_000)
    for (const key of uploadTokens.keys()) recentUploadTokens(key, Date.now() - HOUR_MS);
}

/**
 * Counts recent rows in person_edits rather than keeping a throttle table —
 * person_edits_throttle_idx covers the anonymous query — plus upload tokens.
 *
 * Anonymous actors are bucketed by hashActor(); signed-in ones by account,
 * with a much higher ceiling so an owner is never locked out of normal work.
 */
export async function assertUnderRateLimit(
  db: SupabaseClient,
  familyId: string,
  actorHash: string,
  actorId: string | null,
): Promise<void> {
  const since = Date.now() - HOUR_MS;
  const query = db
    .from("person_edits")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .gte("created_at", new Date(since).toISOString());
  const { count, error } = await (actorId
    ? query.eq("actor_id", actorId)
    : query.eq("actor_hash", actorHash).is("actor_id", null));

  if (error) throw error;
  const limit = actorId ? SIGNED_IN_RATE_LIMIT_PER_HOUR : RATE_LIMIT_PER_HOUR;
  const uploads = recentUploadTokens(bucketOf(familyId, actorHash, actorId), since);
  if ((count ?? 0) + uploads >= limit) throw new RateLimitError();
}
