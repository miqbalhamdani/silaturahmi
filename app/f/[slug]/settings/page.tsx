import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { serviceClient } from "@/lib/supabase/service";
import { currentUserId } from "@/lib/supabase/server";
import { findFamilyBySlug } from "@/lib/mappers";
import SettingsForm from "./settings-form";
import EditLog, { type EditRow } from "./edit-log";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Family settings — Silaturahmi",
  robots: { index: false, follow: false },
};

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const db = serviceClient();
  const family = await findFamilyBySlug(db, slug);
  if (!family) notFound();

  const userId = await currentUserId();
  // Unlike /f/[slug], the slug is not enough here — settings are owner-only.
  if (!userId) redirect("/login");
  if (userId !== family.owner_id) notFound();

  const { data } = await db
    .from("person_edits")
    .select("id, entity, action, before, after, actor_id, reverted_at, created_at")
    .eq("family_id", family.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="h-full overflow-y-auto px-6 py-12">
      <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/f/${slug}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to the tree
      </Link>

      <h1 className="mt-6 font-display text-3xl">{family.name} settings</h1>

      <SettingsForm
        slug={slug}
        name={family.name}
        description={family.description ?? ""}
        hasCover={Boolean(family.cover_key)}
      />

      <EditLog slug={slug} rows={(data ?? []) as EditRow[]} />
    </div>
    </main>
  );
}
