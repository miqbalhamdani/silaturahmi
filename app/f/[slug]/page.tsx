import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FamilyTreeApp from "@/components/FamilyTreeApp";
import { serviceClient } from "@/lib/supabase/service";
import { currentUserId } from "@/lib/supabase/server";
import { findFamilyBySlug, loadFamilyData } from "@/lib/mappers";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ person?: string }>;

// The slug is a secret capability, so nothing about this page may be cached
// or indexed. next.config.ts adds X-Robots-Tag and Referrer-Policy on /f/:path*.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const family = await findFamilyBySlug(serviceClient(), slug);
  return {
    title: family ? `${family.name} — Silaturahmi` : "Silaturahmi",
    robots: { index: false, follow: false },
  };
}

export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  // Next 16: both are Promises.
  const { slug } = await params;
  const { person } = await searchParams;

  const db = serviceClient();
  const family = await findFamilyBySlug(db, slug);
  // A rotated slug 404s here — that is the whole revocation story.
  if (!family) notFound();

  const [data, userId] = await Promise.all([loadFamilyData(db, family.id), currentUserId()]);

  return (
    <FamilyTreeApp
      initialData={data}
      familyName={family.name}
      familySlug={family.slug}
      initialPersonSlug={person}
      isOwner={userId === family.owner_id}
    />
  );
}
