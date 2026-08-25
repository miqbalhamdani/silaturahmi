import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyData, Person, Union } from "./types";
import { MEDIA_BUCKET } from "./supabase/service";

/** Signed read URLs last an hour — long enough that a session rarely outlives one. */
const SIGNED_URL_TTL = 3600;

export interface FamilyRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_key: string | null;
  owner_id: string;
}

interface PersonRow {
  id: string;
  slug: string;
  name: string;
  birth_year: number;
  death_year: number | null;
  bio: string | null;
  gender: "male" | "female" | null;
  photo_key: string | null;
  parent_union_id: string | null;
  sibling_order: number;
}

interface UnionRow {
  id: string;
  partner_a: string;
  partner_b: string | null;
  married_year: number | null;
}

const PERSON_COLUMNS =
  "id, slug, name, birth_year, death_year, bio, gender, photo_key, parent_union_id, sibling_order";
const UNION_COLUMNS = "id, partner_a, partner_b, married_year";

/**
 * Mint every signed URL the page needs in ONE call.
 *
 * createSignedUrl (singular) inside a .map() over a 200-person family is 200
 * round trips per render. The plural form is one.
 */
async function signPaths(db: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  // A broken photo must not take the whole tree down: DetailPanel already
  // falls back to initials on image error.
  if (error || !data) return urls;

  for (const entry of data) {
    if (entry.signedUrl && entry.path) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

/**
 * Load a family as the exact shapes the canvas already consumes.
 *
 * Person.id is the SLUG, not the uuid — it is what ?person= carries and what
 * PersonCard's data-person-id selector uses. Union.id is the uuid, because
 * union ids never appear in a URL.
 */
export async function loadFamilyData(db: SupabaseClient, familyId: string): Promise<FamilyData> {
  const [peopleRes, unionsRes] = await Promise.all([
    db
      .from("people")
      .select(PERSON_COLUMNS)
      .eq("family_id", familyId)
      .order("sibling_order", { ascending: true })
      .order("created_at", { ascending: true }),
    db.from("unions").select(UNION_COLUMNS).eq("family_id", familyId),
  ]);

  if (peopleRes.error) throw peopleRes.error;
  if (unionsRes.error) throw unionsRes.error;

  const personRows = (peopleRes.data ?? []) as PersonRow[];
  const unionRows = (unionsRes.data ?? []) as UnionRow[];

  const signed = await signPaths(
    db,
    personRows.map((r) => r.photo_key).filter((k): k is string => Boolean(k)),
  );

  const slugById = new Map(personRows.map((r) => [r.id, r.slug]));

  const people: Person[] = personRows.map((r) => ({
    id: r.slug,
    name: r.name,
    birthYear: r.birth_year,
    deathYear: r.death_year ?? undefined,
    bio: r.bio ?? undefined,
    gender: r.gender ?? undefined,
    photoKey: r.photo_key ?? undefined,
    photoUrl: r.photo_key ? signed.get(r.photo_key) : undefined,
  }));

  // children[] is the inverse of people.parent_union_id, in sibling_order —
  // personRows already arrives sorted, so append order is the render order.
  const childrenByUnion = new Map<string, string[]>();
  for (const r of personRows) {
    if (!r.parent_union_id) continue;
    const list = childrenByUnion.get(r.parent_union_id) ?? [];
    list.push(r.slug);
    childrenByUnion.set(r.parent_union_id, list);
  }

  const unions: Union[] = unionRows.map((u) => ({
    id: u.id,
    // partner_a/partner_b are ordinal — this preserves left/right render order.
    // A single-parent union has no partner_b; the tuple repeats partner_a so
    // the layout still has two endpoints to draw between.
    partners: [
      slugById.get(u.partner_a) ?? u.partner_a,
      slugById.get(u.partner_b ?? u.partner_a) ?? u.partner_a,
    ] as [string, string],
    marriedYear: u.married_year ?? undefined,
    children: childrenByUnion.get(u.id) ?? [],
  }));

  return { people, unions };
}

export async function findFamilyBySlug(
  db: SupabaseClient,
  slug: string,
): Promise<FamilyRow | null> {
  const { data } = await db
    .from("families")
    .select("id, slug, name, description, cover_key, owner_id")
    .eq("slug", slug)
    .maybeSingle();
  return (data as FamilyRow | null) ?? null;
}

/** Resolve a client-facing person slug to its uuid, scoped to one family. */
export async function personIdBySlug(
  db: SupabaseClient,
  familyId: string,
  slug: string,
): Promise<string | null> {
  const { data } = await db
    .from("people")
    .select("id")
    .eq("family_id", familyId)
    .eq("slug", slug)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function signOne(db: SupabaseClient, path: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  return (await signPaths(db, [path])).get(path);
}
