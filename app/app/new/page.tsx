import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WizardForm from "./wizard-form";

export const metadata: Metadata = { title: "Create a family — Silaturahmi" };

export default function NewFamilyPage() {
  return (
    <main className="h-full overflow-y-auto px-6 py-12">
      <div className="mx-auto w-full max-w-xl">
      <Link
        href="/app"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </Link>
      <h1 className="mt-6 font-display text-3xl">Create your family</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Two things to start: what the family is called, and one person to build out from.
      </p>
      <WizardForm />
    </div>
    </main>
  );
}
