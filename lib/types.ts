export interface Person {
  id: string;
  name: string;
  birthYear: number;
  deathYear?: number; // undefined = living
  bio?: string;
  photoUrl?: string; // display only: data: URL, blob: URL, or a signed Storage URL
  photoKey?: string; // what persists: a Storage object path. Absent in local mode.
  gender?: "male" | "female"; // undefined = unknown
}

export interface Union {
  id: string;
  partners: [string, string]; // person ids, left/right render order
  marriedYear?: number;
  children: string[]; // person ids, left→right sibling order
}

export interface FamilyData {
  people: Person[];
  unions: Union[];
}

export type Relation =
  | { kind: "child"; unionId: string }
  | { kind: "spouse"; personId: string };

export interface PersonDraft {
  name: string;
  birthYear: number;
  deathYear?: number;
  bio?: string;
  photoUrl?: string;
  photoKey?: string;
  gender?: "male" | "female";
  relation: Relation;
}

export type PersonPatch = Omit<PersonDraft, "relation">;

// photoUrl is a signed, expiring URL in server mode — writing it back would
// corrupt photo_key. Uploads return both halves so the form keeps them apart.
export interface PhotoRef {
  photoUrl: string;
  photoKey?: string;
}
