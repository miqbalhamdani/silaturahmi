export interface Person {
  id: string;
  name: string;
  birthYear: number;
  deathYear?: number; // undefined = living
  bio?: string;
  photoUrl?: string; // http(s) or data: URL; initials shown when absent
  gender?: "male" | "female"; // undefined = unknown
}

export interface Union {
  id: string;
  partners: [string, string]; // person ids, left/right render order
  marriedYear?: number;
  children: string[]; // person ids, left→right sibling order
}
