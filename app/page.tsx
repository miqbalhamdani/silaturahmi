import FamilyTreeApp from "@/components/FamilyTreeApp";
import { familyName, people, unions } from "@/lib/data";

/**
 * The public demo tree. No database, no slug — FamilyTreeApp falls back to its
 * local reducers when familySlug is absent, so edits here live in React state
 * and vanish on reload. That is the point: it is the "try it" page.
 */
export default function Home() {
  return <FamilyTreeApp initialData={{ people, unions }} familyName={familyName} />;
}
