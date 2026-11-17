// Slug helpers shared by the client canvas and by server code. This file must
// stay free of "use client" and of any Node-only import so both can use it.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Lowercase, hyphen-joined, matching the DB's `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`. */
export function slugify(base: string): string {
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "person"
  );
}

/** `slugify` plus collision suffixes against ids already in use. */
export function uniqueId(base: string, taken: Set<string>): string {
  const slug = slugify(base);
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

/**
 * Unguessable suffix. 12 chars of a 36-symbol alphabet is ~62 bits — see §3 of
 * docs/supabase-integration.md. Uses the Web Crypto API, which exists in both
 * the browser and the Node/Edge runtimes, so no dependency and no `node:crypto`.
 */
export function randomSuffix(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  // 256 % 36 != 0, so raw modulo is very slightly biased toward the first four
  // symbols. At 62 bits of entropy that bias is nowhere near exploitable, and
  // rejection sampling here would be ceremony.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * The namespace slug: a cosmetic readable prefix plus the entropy that actually
 * protects the family. Never derive one from the name alone.
 */
export function familySlugFor(name: string): string {
  return `${slugify(name)}-${randomSuffix()}`;
}

/** Storage object path. Family-scoped so purging a family is one prefix delete. */
export function photoPath(familyId: string, ext: string): string {
  return `families/${familyId}/photos/${randomSuffix(16)}.${ext}`;
}

export function coverPath(familyId: string, ext: string): string {
  return `families/${familyId}/cover/${randomSuffix(16)}.${ext}`;
}

/**
 * True only for an object directly in this family's own folder. Keys arrive
 * from the client and are signed and deleted with the service-role key, so
 * anything else — another family's path, `..` — must never be trusted.
 */
export function isMediaKey(key: unknown, familyId: string, folder: "photos" | "cover"): key is string {
  const prefix = `families/${familyId}/${folder}/`;
  return (
    typeof key === "string" &&
    key.startsWith(prefix) &&
    /^[A-Za-z0-9._-]+$/.test(key.slice(prefix.length)) &&
    !key.includes("..")
  );
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT_BY_MIME);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function extForMime(mime: string): string | undefined {
  return EXT_BY_MIME[mime];
}
