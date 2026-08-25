// One source of truth for the person rules. AddPersonPanel checks the string
// form for UX; the Server Action re-checks the parsed form because client
// validation is an affordance, not a boundary.

import type { PersonDraft, PersonPatch } from "./types";

export const MIN_YEAR = 1200;
export const currentYear = () => new Date().getFullYear();

export function nameError(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (trimmed.length > 120) return "Name is too long.";
  return undefined;
}

export function birthYearError(year: number, now = currentYear()): string | undefined {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > now)
    return `Enter a year between ${MIN_YEAR} and ${now}.`;
  return undefined;
}

export function deathYearError(
  death: number | undefined,
  birth: number,
  now = currentYear(),
): string | undefined {
  if (death === undefined) return undefined;
  if (!Number.isInteger(death) || death > now) return `Enter a year up to ${now}.`;
  if (Number.isInteger(birth) && death < birth) return "Death year can't be before birth year.";
  return undefined;
}

/** Thrown by the actions and surfaced to the panel as a form-level message. */
export class ValidationError extends Error {}

export function assertValidPerson(p: PersonDraft | PersonPatch): void {
  const problem =
    nameError(p.name) ??
    birthYearError(p.birthYear) ??
    deathYearError(p.deathYear, p.birthYear);
  if (problem) throw new ValidationError(problem);
  if (p.gender !== undefined && p.gender !== "male" && p.gender !== "female")
    throw new ValidationError("Gender must be male or female.");
  if (p.bio && p.bio.length > 4000) throw new ValidationError("Bio is too long.");
}
