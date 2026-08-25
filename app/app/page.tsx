import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { currentUser } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "Your families — Silaturahmi" };

interface FamilyListRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export default async function AppPage() {
  const user = await currentUser();
  // proxy.ts already redirected, but that check is optimistic by design —
  // this is the real one.
  if (!user) redirect("/login");

  const db = serviceClient();
  const { data } = await db
    .from("families")
    .select("id, slug, name, description")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const families = (data ?? []) as FamilyListRow[];
  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email;

  return (
    <main className="h-full overflow-y-auto px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Your families</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {displayName}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>

      {families.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-border bg-surface p-10 text-center">
          <Users aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 font-display text-2xl">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Create your family, add the first person, and you&rsquo;ll get a private link you can
            share with relatives.
          </p>
          <Link
            href="/app/new"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            <Plus aria-hidden className="size-4" />
            Create a family
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 space-y-3">
            {families.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/f/${f.slug}`}
                  className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-primary/5"
                >
                  <span className="font-display text-xl">{f.name}</span>
                  {f.description && (
                    <span className="mt-1 block text-sm text-muted-foreground">{f.description}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/app/new"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium transition-colors hover:bg-primary/5"
          >
            <Plus aria-hidden className="size-4" />
            Create another family
          </Link>
        </>
      )}
    </div>
    </main>
  );
}
