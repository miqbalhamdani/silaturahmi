import type { Person, Union } from "./types";

// Layout constraint: each person is a partner in at most one union, and
// exactly one root union exists (partners who are nobody's child).
// Remarriage / multi-union needs a DAG layout — out of scope.

export const familyName = "Santoso";

const genders: Record<string, "male" | "female"> = {
  ahmad: "male", aminah: "female", budi: "male", ratna: "female", dewi: "female",
  farhan: "male", hasan: "male", indra: "male", lestari: "female", kartika: "female",
  nadia: "female", omar: "male", putri: "female", raka: "male",
};

export const people: Person[] = [
  { id: "ahmad", name: "Haji Ahmad", birthYear: 1938, deathYear: 2012, bio: "Patriarch of the family. A rice farmer from Cianjur who put all three children through school." },
  { id: "aminah", name: "Siti Aminah", birthYear: 1944, deathYear: 2020, bio: "Matriarch and famed cook — her rendang recipe is still the standard at every family gathering." },
  { id: "budi", name: "Budi Santoso", birthYear: 1963, bio: "Eldest son. Retired civil engineer, now tends the family orchard." },
  { id: "ratna", name: "Ratna Sari", birthYear: 1966, bio: "Schoolteacher for 30 years; married into the family in 1988." },
  { id: "dewi", name: "Dewi Lestari", birthYear: 1966, bio: "Middle child. Runs a batik workshop in Yogyakarta." },
  { id: "farhan", name: "Farhan Hakim", birthYear: 1962, deathYear: 2021, bio: "Journalist and devoted father of two." },
  { id: "hasan", name: "Hasan Basri", birthYear: 1970, bio: "Youngest son. A marine biologist who never left the sea long enough to marry." },
  { id: "indra", name: "Indra Santoso", birthYear: 1990, bio: "Software engineer in Jakarta. Keeper of the family group chat." },
  { id: "lestari", name: "Lestari Putri", birthYear: 1992, bio: "Architect; married Indra in 2016." },
  { id: "kartika", name: "Kartika Santoso", birthYear: 1994, bio: "Pediatric nurse, the one everyone calls first." },
  { id: "nadia", name: "Nadia Hakim", birthYear: 1993, bio: "Documentary filmmaker following her father's footsteps." },
  { id: "omar", name: "Omar Hakim", birthYear: 1996, bio: "Chef; plans to reopen his grandmother's warung." },
  { id: "putri", name: "Putri Santoso", birthYear: 2018, bio: "Loves drawing and her grandfather's mangoes." },
  { id: "raka", name: "Raka Santoso", birthYear: 2021, bio: "The youngest of the family." },
  // demo portraits; replaced by real photos when the DB arrives
].map((p) => ({
  ...p,
  gender: genders[p.id],
  photoUrl: `https://i.pravatar.cc/400?u=silaturahmi-${p.id}`,
}));

export const unions: Union[] = [
  { id: "u-root", partners: ["ahmad", "aminah"], marriedYear: 1961, children: ["budi", "dewi", "hasan"] },
  { id: "u-budi", partners: ["budi", "ratna"], marriedYear: 1988, children: ["indra", "kartika"] },
  { id: "u-dewi", partners: ["dewi", "farhan"], marriedYear: 1990, children: ["nadia", "omar"] },
  { id: "u-indra", partners: ["indra", "lestari"], marriedYear: 2016, children: ["putri", "raka"] },
];

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
