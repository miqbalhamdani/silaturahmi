"use client";

import { createContext, useContext } from "react";
import type {
  FamilyData,
  Person,
  PersonDraft,
  PersonPatch,
  PhotoRef,
  Union,
} from "./types";
import { uniqueId } from "./slug";

// These moved to ./types so server code can import them — this module is
// "use client", and a Server Action cannot pull from it at runtime.
export type { FamilyData, PersonDraft, PersonPatch, PhotoRef, Relation } from "./types";

// The single mutation seam — swap this for a DB call later.
export function applyAddPerson(
  data: FamilyData,
  draft: PersonDraft,
): { data: FamilyData; person: Person } {
  const taken = new Set([...data.people.map((p) => p.id), ...data.unions.map((u) => u.id)]);
  const person: Person = {
    id: uniqueId(draft.name, taken),
    name: draft.name.trim(),
    birthYear: draft.birthYear,
    deathYear: draft.deathYear,
    bio: draft.bio?.trim() || undefined,
    photoUrl: draft.photoUrl || undefined,
    photoKey: draft.photoKey || undefined,
    gender: draft.gender,
  };

  if (draft.relation.kind === "child") {
    const unionId = draft.relation.unionId;
    return {
      person,
      data: {
        people: [...data.people, person],
        unions: data.unions.map((u) =>
          u.id === unionId ? { ...u, children: [...u.children, person.id] } : u,
        ),
      },
    };
  }

  const partnerId = draft.relation.personId;
  const union: Union = {
    id: uniqueId(`u-${person.id}`, taken),
    partners: [partnerId, person.id],
    children: [],
  };
  return {
    person,
    data: { people: [...data.people, person], unions: [...data.unions, union] },
  };
}

// The update seam — swap this for a DB call later.
export function applyUpdatePerson(data: FamilyData, personId: string, patch: PersonPatch): FamilyData {
  return {
    unions: data.unions,
    people: data.people.map((p) =>
      p.id === personId
        ? {
            ...p,
            name: patch.name.trim(),
            birthYear: patch.birthYear,
            deathYear: patch.deathYear,
            bio: patch.bio?.trim() || undefined,
            photoUrl: patch.photoUrl || undefined,
            photoKey: patch.photoKey || undefined,
            gender: patch.gender,
          }
        : p,
    ),
  };
}

export function unmarriedPeople(data: FamilyData): Person[] {
  return data.people.filter((p) => !data.unions.some((u) => u.partners.includes(p.id)));
}

// Async because /f/[slug] routes these through Server Actions. The local-only
// canvas on / wraps the pure reducers above to satisfy the same shape.
export interface FamilyContextValue {
  people: Person[];
  unions: Union[];
  peopleById: Map<string, Person>;
  addPerson: (draft: PersonDraft) => Promise<Person>;
  updatePerson: (personId: string, patch: PersonPatch) => Promise<void>;
  /** Local mode returns a data: URL; server mode uploads and returns a path. */
  uploadPhoto: (file: File) => Promise<PhotoRef>;
}

export const FamilyContext = createContext<FamilyContextValue | null>(null);

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily outside FamilyContext");
  return ctx;
}

// self-check: npx tsx lib/family.tsx
if (typeof process !== "undefined" && process.argv[1]?.endsWith("family.tsx")) {
  import("./data").then(({ people, unions }) => {
    const seed: FamilyData = { people, unions };
    // add child
    const c = applyAddPerson(seed, {
      name: "Hasan Basri", // collides with existing id "hasan"? slug is "hasan-basri" — force a real collision below
      birthYear: 2024,
      relation: { kind: "child", unionId: "u-indra" },
    });
    console.assert(c.data.people.length === people.length + 1, "child appended");
    console.assert(
      c.data.unions.find((u) => u.id === "u-indra")!.children.at(-1) === c.person.id,
      "child in union",
    );
    console.assert(seed.unions.find((u) => u.id === "u-indra")!.children.length === 2, "input not mutated");
    // id collision
    const dup = applyAddPerson(c.data, {
      name: "Hasan Basri",
      birthYear: 2025,
      relation: { kind: "child", unionId: "u-root" },
    });
    console.assert(dup.person.id !== c.person.id, "unique id under collision");
    // add spouse → childless union, single root preserved
    const s = applyAddPerson(seed, {
      name: "Aisyah Rahma",
      birthYear: 1972,
      relation: { kind: "spouse", personId: "hasan" },
    });
    const nu = s.data.unions.at(-1)!;
    console.assert(nu.partners.includes("hasan") && nu.children.length === 0, "spouse union childless");
    const childSet = new Set(s.data.unions.flatMap((u) => u.children));
    const roots = s.data.unions.filter((u) => u.partners.every((p) => !childSet.has(p)));
    console.assert(roots.length === 1, "one root preserved");
    console.assert(unmarriedPeople(s.data).every((p) => p.id !== "hasan"), "hasan now married");
    // update person
    const u2 = applyUpdatePerson(seed, "hasan", {
      name: "Hasan B. Santoso",
      birthYear: 1971,
      bio: "",
      gender: "male",
    });
    const hasan = u2.people.find((p) => p.id === "hasan")!;
    console.assert(hasan.name === "Hasan B. Santoso" && hasan.birthYear === 1971, "update applied");
    console.assert(hasan.gender === "male", "gender round-trips");
    console.assert(hasan.bio === undefined, "empty bio cleared");
    console.assert(seed.people.find((p) => p.id === "hasan")!.birthYear === 1970, "update input not mutated");
    console.log("family self-check passed");
  });
}
