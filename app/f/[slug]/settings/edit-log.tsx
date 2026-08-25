"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { revertEditAction } from "@/lib/actions/family";

export interface EditRow {
  id: number;
  entity: string;
  action: string;
  before: { name?: string } | null;
  after: { name?: string } | null;
  actor_id: string | null;
  reverted_at: string | null;
  created_at: string;
}

const VERB: Record<string, string> = {
  insert: "added",
  update: "edited",
  delete: "removed",
  revert: "reverted",
};

export default function EditLog({ slug, rows }: { slug: string; rows: EditRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function revert(id: number) {
    startTransition(async () => {
      try {
        await revertEditAction(slug, id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not revert that change.");
      }
    });
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Recent changes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every edit, including those made by anyone holding the share link.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-accent">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing has changed yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => {
            const subject = row.after?.name ?? row.before?.name ?? row.entity;
            // A revert entry is itself auditable, but reverting a revert would
            // just flip-flop; only forward edits offer the button.
            const revertible =
              !row.reverted_at &&
              row.action !== "revert" &&
              (row.entity === "person" || row.entity === "union");

            return (
              <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-medium">{subject}</span>{" "}
                    <span className="text-muted-foreground">
                      {VERB[row.action] ?? row.action}
                      {row.actor_id ? " by you" : " by a link visitor"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                    {row.reverted_at && " · reverted"}
                  </p>
                </div>
                {revertible && (
                  <button
                    type="button"
                    onClick={() => revert(row.id)}
                    disabled={pending}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-primary/5 disabled:opacity-60"
                  >
                    <Undo2 aria-hidden className="size-3.5" />
                    Undo
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
