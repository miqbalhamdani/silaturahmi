"use server";

import { redirect } from "next/navigation";
import { serviceClient } from "@/lib/supabase/service";
import { currentUserId } from "@/lib/supabase/server";
import { hashActor } from "@/lib/actor";
import { familySlugFor, slugify } from "@/lib/slug";
import { birthYearError, nameError } from "@/lib/validation";

export interface WizardState {
  error?: string;
  /**
   * Echoed back so the form can repopulate. A form submitted through a Server
   * Action is reset by React afterwards, which wipes uncontrolled inputs — so
   * an error would otherwise cost the user everything they typed.
   */
  values?: {
    familyName: string;
    description: string;
    personName: string;
    birthYear: string;
    gender: string;
  };
}

/**
 * Postgres messages are for us, not for the person filling in the form — but
 * throwing them away entirely (as this action first did) leaves nobody able to
 * tell why a save failed. Log the real thing, show a usable summary.
 */
function describeDbError(context: string, error: { message?: string; code?: string } | null): string {
  console.error(`[createFamilyAction] ${context}:`, error);
  const msg = error?.message ?? "";

  // By far the most common cause in a fresh setup: SUPABASE_SERVICE_ROLE_KEY
  // holds the anon key, so the client is subject to RLS and every insert is
  // refused. Nothing about "row-level security policy" tells you that.
  // PostgREST caches the schema. A table that exists in Postgres but was added
  // after the cache was built reads as "not found" until the cache reloads —
  // and an unapplied migration looks identical from here.
  if (msg.includes("schema cache") || msg.includes("does not exist"))
    return "The database is missing this project's tables. Apply supabase/migrations to the project in NEXT_PUBLIC_SUPABASE_URL (`supabase db push` for a cloud project), then reload the schema.";

  if (msg.includes("row-level security"))
    return "The server is not using its service-role key, so the database refused the write. Check SUPABASE_SERVICE_ROLE_KEY in .env.local — the anon key will not work here.";

  if (msg.includes("families_slug_key")) return "That link was already taken. Try again.";
  if (msg.includes("violates foreign key")) return "Your account is not recognised. Sign out and back in.";
  if (msg.includes("description_check") || msg.includes("value too long"))
    return "That description is too long — keep it under 2000 characters.";

  return msg ? `${context}: ${msg}` : `${context}. Try again.`;
}

/**
 * Creates the family and its first person together — step 3 of the product
 * flow. The first person is the only one ever created with p_rel_kind='root';
 * every later write is "child of a union" or "spouse of a person", which is
 * what keeps the single-root invariant that lib/layout.ts depends on.
 */
export async function createFamilyAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const familyName = String(formData.get("familyName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const personName = String(formData.get("personName") ?? "").trim();
  const birthYearRaw = String(formData.get("birthYear") ?? "").trim();
  const birthYear = Number(birthYearRaw);
  const genderRaw = String(formData.get("gender") ?? "");
  const gender = genderRaw === "male" || genderRaw === "female" ? genderRaw : null;

  const values = { familyName, description, personName, birthYear: birthYearRaw, gender: genderRaw };
  const fail = (error: string): WizardState => ({ error, values });

  if (!familyName) return fail("Give the family a name.");
  if (familyName.length > 120) return fail("That family name is too long.");
  if (description.length > 2000) return fail("Keep the description under 2000 characters.");

  if (!birthYearRaw) return fail("Enter a birth year for the first person.");
  const personProblem = nameError(personName) ?? birthYearError(birthYear);
  if (personProblem) return fail(personProblem);
  if (!gender) return fail("Choose Male or Female for the first person.");

  const db = serviceClient();
  const slug = familySlugFor(familyName);

  const { data: family, error: familyError } = await db
    .from("families")
    .insert({
      slug,
      name: familyName,
      description: description || null,
      owner_id: userId,
    })
    .select("id, slug")
    .single();

  if (familyError || !family) return fail(describeDbError("Could not create the family", familyError));

  const { error: personError } = await db.rpc("app_add_person", {
    p_family_id: family.id,
    p_slug: slugify(personName),
    p_name: personName,
    p_birth_year: birthYear,
    p_death_year: null,
    p_bio: null,
    p_gender: gender,
    p_photo_key: null,
    p_rel_kind: "root",
    p_rel_target: null,
    p_actor_id: userId,
    p_actor_hash: await hashActor(),
  });

  if (personError) {
    // Roll the family back by hand: two statements, two transactions, and a
    // family with no people would strand the owner on an empty canvas.
    await db.from("families").delete().eq("id", family.id);
    return fail(describeDbError("Could not add the first person", personError));
  }

  redirect(`/f/${family.slug}`);
}
