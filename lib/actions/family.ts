"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { serviceClient, MEDIA_BUCKET } from "../supabase/service";
import { currentUserId } from "../supabase/server";
import { assertUnderRateLimit, hashActor, noteUploadToken, RateLimitError } from "../actor";
import { findFamilyBySlug, loadFamilyData, personIdBySlug, type FamilyRow } from "../mappers";
import { assertValidPerson, ValidationError } from "../validation";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  extForMime,
  familySlugFor,
  isMediaKey,
  photoPath,
  slugify,
} from "../slug";
import type { FamilyData, PersonDraft, PersonPatch } from "../types";
// Anything thrown as an ActionError is shown to the user verbatim.
import { ActionError } from "../errors";

interface Actor {
  family: FamilyRow;
  db: SupabaseClient;
  actorId: string | null;
  actorHash: string;
}

/**
 * The preamble every public action shares (§6).
 *
 * Step 1 IS the authorization check for anonymous traffic: holding the slug is
 * the capability, and there is no other gate. RLS cannot see a URL, which is
 * why this runs on a service-role client rather than as a policy.
 */
async function openFamily(slug: string): Promise<Actor> {
  const db = serviceClient();
  const family = await findFamilyBySlug(db, slug);
  if (!family) throw new ActionError("This family link is not valid.");

  const actorId = await currentUserId();
  const actorHash = await hashActor();
  await assertUnderRateLimit(db, family.id, actorHash, actorId);

  return { family, db, actorId, actorHash };
}

/** Owner-only actions layer this on top. */
async function requireOwner(slug: string): Promise<Actor> {
  const ctx = await openFamily(slug);
  if (!ctx.actorId || ctx.actorId !== ctx.family.owner_id)
    throw new ActionError("Only the family owner can do that.");
  return ctx;
}

/**
 * Postgres errors carry the constraint that failed. Surfacing the raw message
 * would leak schema detail and read as a crash; these are the ones a normal
 * user can actually trigger.
 */
function toUserMessage(error: { message?: string; code?: string }): string {
  const msg = error.message ?? "";
  if (msg.includes("already a partner")) return "That person already has a spouse.";
  if (msg.includes("ancestor cycle")) return "That would make someone their own ancestor.";
  if (msg.includes("people_slug_unique")) return "Someone with that name was just added. Try again.";
  if (msg.includes("unions_pair_uniq")) return "Those two are already partners.";
  if (msg.includes("people_death_after_birth")) return "Death year can't be before birth year.";

  // Misconfiguration, not user error: with the anon key in
  // SUPABASE_SERVICE_ROLE_KEY the client is subject to RLS and every write is
  // refused. "row-level security policy" tells nobody that on its own.
  // PostgREST caches the schema. A table that exists in Postgres but was added
  // after the cache was built reads as "not found" until the cache reloads —
  // and an unapplied migration looks identical from here.
  if (msg.includes("schema cache") || msg.includes("does not exist"))
    return "The database is missing this project's tables. Apply supabase/migrations to the project in NEXT_PUBLIC_SUPABASE_URL (`supabase db push` for a cloud project), then reload the schema.";

  if (msg.includes("row-level security"))
    return "The server is not using its service-role key, so the database refused the write. Check SUPABASE_SERVICE_ROLE_KEY in .env.local.";

  // Anything unrecognised: log the real thing and carry a summary out, rather
  // than swallowing it and leaving a failure nobody can diagnose.
  console.error("[family action] unmapped database error:", error);
  return msg ? `That change could not be saved: ${msg}` : "That change could not be saved.";
}

/**
 * A client-supplied Storage key, or null for none. A key outside this family's
 * own folder is refused: stored, it would be signed for anyone holding this
 * slug and later deleted with the service-role key.
 */
function checkedKey(familyId: string, folder: "photos" | "cover", key: unknown): string | null {
  if (key === undefined || key === null || key === "") return null;
  if (!isMediaKey(key, familyId, folder)) throw new ValidationError("That image is not part of this family.");
  return key;
}

function rethrow(e: unknown): never {
  if (e instanceof ActionError || e instanceof ValidationError || e instanceof RateLimitError)
    throw new ActionError(e.message);
  const err = e as { message?: string; code?: string };
  throw new ActionError(toUserMessage(err));
}

/**
 * A slug unique within the family. The DB's (family_id, slug) constraint is the
 * real guarantee — this just avoids burning a round trip on the common case.
 */
async function nextPersonSlug(db: SupabaseClient, familyId: string, name: string): Promise<string> {
  const base = slugify(name);
  const { data } = await db
    .from("people")
    .select("slug")
    .eq("family_id", familyId)
    .like("slug", `${base}%`);

  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Add a person and return the family's WHOLE graph alongside them.
 *
 * Returning everything means the canvas has no merge logic and no id
 * reconciliation to get wrong: it swaps one useState value. The read is the two
 * indexed selects the page already does.
 */
export async function addPersonAction(
  slug: string,
  draft: PersonDraft,
): Promise<{ data: FamilyData; personSlug: string }> {
  try {
    const { family, db, actorId, actorHash } = await openFamily(slug);
    assertValidPerson(draft);

    // Person.id is a slug on the client; the RPCs take uuids.
    let relTarget: string | null = null;
    if (draft.relation.kind === "child") {
      relTarget = draft.relation.unionId;
    } else {
      relTarget = await personIdBySlug(db, family.id, draft.relation.personId);
      if (!relTarget) throw new ActionError("That person is no longer in this family.");
    }

    const personSlug = await nextPersonSlug(db, family.id, draft.name);

    const { data: row, error } = await db.rpc("app_add_person", {
      p_family_id: family.id,
      p_slug: personSlug,
      p_name: draft.name.trim(),
      p_birth_year: draft.birthYear,
      p_death_year: draft.deathYear ?? null,
      p_bio: draft.bio ?? null,
      p_gender: draft.gender ?? null,
      p_photo_key: checkedKey(family.id, "photos", draft.photoKey),
      p_rel_kind: draft.relation.kind,
      p_rel_target: relTarget,
      p_actor_id: actorId,
      p_actor_hash: actorHash,
    });
    if (error) throw error;

    const data = await loadFamilyData(db, family.id);
    revalidatePath(`/f/${slug}`);
    return { data, personSlug: (row as { slug: string } | null)?.slug ?? personSlug };
  } catch (e) {
    rethrow(e);
  }
}

export async function updatePersonAction(
  slug: string,
  personSlug: string,
  patch: PersonPatch,
): Promise<FamilyData> {
  try {
    const { family, db, actorId, actorHash } = await openFamily(slug);
    assertValidPerson(patch);

    const personId = await personIdBySlug(db, family.id, personSlug);
    if (!personId) throw new ActionError("That person is no longer in this family.");

    const { error } = await db.rpc("app_update_person", {
      p_person_id: personId,
      p_name: patch.name.trim(),
      p_birth_year: patch.birthYear,
      p_death_year: patch.deathYear ?? null,
      p_bio: patch.bio ?? null,
      p_gender: patch.gender ?? null,
      p_photo_key: checkedKey(family.id, "photos", patch.photoKey),
      p_actor_id: actorId,
      p_actor_hash: actorHash,
    });
    if (error) throw error;

    // A replaced or removed photo's object is deliberately kept:
    // app_revert_edit restores photo_key from history, and the revert is only
    // worth anything if the bytes are still there.
    // TODO: sweep orphans later — objects under families/<id>/photos/ that no
    // people row and no person_edits before/after references.

    const data = await loadFamilyData(db, family.id);
    revalidatePath(`/f/${slug}`);
    return data;
  } catch (e) {
    rethrow(e);
  }
}

export async function deletePersonAction(slug: string, personSlug: string): Promise<FamilyData> {
  try {
    const { family, db, actorId, actorHash } = await requireOwner(slug);

    const personId = await personIdBySlug(db, family.id, personSlug);
    if (!personId) throw new ActionError("That person is no longer in this family.");

    // A deleted person's photo object would otherwise be orphaned forever.
    // Only ever this family's own objects: the service-role key deletes it.
    const { data: before } = await db
      .from("people")
      .select("photo_key")
      .eq("id", personId)
      .maybeSingle();

    const { error } = await db.rpc("app_delete_person", {
      p_person_id: personId,
      p_actor_id: actorId,
      p_actor_hash: actorHash,
    });
    if (error) throw error;

    const oldKey = before?.photo_key as string | null | undefined;
    if (isMediaKey(oldKey, family.id, "photos")) {
      const { error: rmError } = await db.storage.from(MEDIA_BUCKET).remove([oldKey]);
      if (rmError) console.error("[family action] could not remove deleted person's photo:", rmError);
    }

    const data = await loadFamilyData(db, family.id);
    revalidatePath(`/f/${slug}`);
    return data;
  } catch (e) {
    rethrow(e);
  }
}

export async function updateFamilyAction(
  slug: string,
  settings: { name: string; description: string; coverKey?: string | null },
): Promise<void> {
  try {
    const { family, db } = await requireOwner(slug);
    const name = settings.name.trim();
    if (!name || name.length > 120) throw new ValidationError("Family name is required.");

    const patch: Record<string, unknown> = {
      name,
      description: settings.description.trim() || null,
    };
    // undefined means "not touched"; null means "cleared".
    if (settings.coverKey !== undefined)
      patch.cover_key = checkedKey(family.id, "cover", settings.coverKey);

    const { error } = await db.from("families").update(patch).eq("id", family.id);
    if (error) throw error;

    revalidatePath(`/f/${slug}`);
    revalidatePath(`/f/${slug}/settings`);
  } catch (e) {
    rethrow(e);
  }
}

/**
 * Rotate the namespace slug. This is the ONLY revocation mechanism — the old
 * URL 404s immediately and everyone holding it loses access, including people
 * the owner meant to keep.
 */
export async function rotateSlugAction(slug: string): Promise<string> {
  try {
    const { family, db } = await requireOwner(slug);
    const next = familySlugFor(family.name);

    const { error } = await db.from("families").update({ slug: next }).eq("id", family.id);
    if (error) throw error;

    revalidatePath(`/f/${slug}`);
    return next;
  } catch (e) {
    rethrow(e);
  }
}

export async function revertEditAction(slug: string, editId: number): Promise<FamilyData> {
  try {
    const { family, db, actorId, actorHash } = await requireOwner(slug);

    // Scope the id to this family so an owner cannot revert another family's
    // history by guessing a bigserial.
    const { data: edit } = await db
      .from("person_edits")
      .select("id")
      .eq("id", editId)
      .eq("family_id", family.id)
      .maybeSingle();
    if (!edit) throw new ActionError("That edit is not part of this family.");

    const { error } = await db.rpc("app_revert_edit", {
      p_edit_id: editId,
      p_actor_id: actorId,
      p_actor_hash: actorHash,
    });
    if (error) throw error;

    const data = await loadFamilyData(db, family.id);
    revalidatePath(`/f/${slug}`);
    revalidatePath(`/f/${slug}/settings`);
    return data;
  } catch (e) {
    rethrow(e);
  }
}

/**
 * Mint a one-shot upload token. The bytes go straight from the browser to
 * Storage, so they never pass through Vercel and the 4.5 MB Server Action body
 * limit is irrelevant.
 *
 * The size/type checks here are a courtesy — the bucket enforces both.
 */
export async function createPhotoUploadUrl(
  slug: string,
  contentType: string,
  bytes: number,
): Promise<{ path: string; token: string }> {
  try {
    const { family, db, actorId, actorHash } = await openFamily(slug);
    noteUploadToken(family.id, actorHash, actorId);

    const ext = extForMime(contentType);
    if (!ext || !ALLOWED_IMAGE_TYPES.includes(contentType))
      throw new ValidationError("Photos must be JPEG, PNG, or WebP.");
    if (bytes > MAX_IMAGE_BYTES) throw new ValidationError("Photos must be under 5 MB.");

    const path = photoPath(family.id, ext);
    const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new ActionError("Could not start the upload.");

    return { path: data.path, token: data.token };
  } catch (e) {
    rethrow(e);
  }
}
