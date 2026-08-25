"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { initials } from "@/lib/data";
import { useFamily } from "@/lib/family";
import type { Person } from "@/lib/types";
import Panel from "./Panel";

interface DetailPanelProps {
  personId: string | null;
  onClose: () => void;
  onJumpTo: (personId: string) => void;
  onEdit: (personId: string) => void;
}

function RelativeRow({ person, onJumpTo }: { person: Person; onJumpTo: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onJumpTo(person.id)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-primary/10"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-semibold text-primary"
        >
          {initials(person.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{person.name}</span>
          <span className="block text-xs text-muted-foreground">
            {person.deathYear ? `${person.birthYear} – ${person.deathYear}` : `b. ${person.birthYear}`}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function DetailPanel({ personId, onClose, onJumpTo, onEdit }: DetailPanelProps) {
  const { peopleById, unions } = useFamily();
  const person = personId ? peopleById.get(personId) : undefined;
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [personId]);
  const photo = !imgFailed ? person?.photoUrl : undefined;

  const parentUnion = personId ? unions.find((u) => u.children.includes(personId)) : undefined;
  const ownUnion = personId ? unions.find((u) => u.partners.includes(personId)) : undefined;
  const rel = {
    parents: parentUnion?.partners ?? [],
    spouse: ownUnion ? ownUnion.partners.filter((p) => p !== personId) : [],
    children: ownUnion?.children ?? [],
  };

  return (
    <Panel
      open={!!person}
      onClose={onClose}
      role="complementary"
      label="Person details"
      returnFocusTo={personId ? `[data-person-id="${personId}"]` : undefined}
    >
      {person && (
        <>
          <div className="relative shrink-0 overflow-hidden rounded-t-2xl">
            {photo ? (
              <img
                src={photo}
                alt={`Portrait of ${person.name}`}
                className="h-52 w-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div
                aria-hidden
                className={`flex h-52 w-full items-center justify-center font-display text-6xl font-semibold ${
                  person.deathYear
                    ? "bg-connector/25 text-muted-foreground"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {initials(person.name)}
              </div>
            )}
            <button
              type="button"
              aria-label="Close details"
              onClick={onClose}
              className="absolute top-3 right-3 rounded-lg bg-surface/80 p-2 text-foreground backdrop-blur transition-colors duration-150 hover:bg-surface"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-3">
            <h2 className="font-display text-2xl font-semibold">{person.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {person.deathYear
                ? `${person.birthYear} – ${person.deathYear}`
                : `Born ${person.birthYear} · ${new Date().getFullYear() - person.birthYear} years old`}
            </p>
            {person.bio && <p className="mt-4 text-sm leading-relaxed">{person.bio}</p>}

            {(
              [
                ["Parents", rel.parents],
                ["Spouse", rel.spouse],
                ["Children", rel.children],
              ] as const
            ).map(([label, ids]) =>
              ids.length === 0 ? null : (
                <section key={label} className="mt-6">
                  <h3 className="text-xs font-semibold tracking-wide text-accent uppercase">{label}</h3>
                  <ul className="mt-2 space-y-1">
                    {ids.map((id) => (
                      <RelativeRow key={id} person={peopleById.get(id)!} onJumpTo={onJumpTo} />
                    ))}
                  </ul>
                </section>
              ),
            )}
          </div>

          <div className="shrink-0 border-t border-border p-4">
            <button
              type="button"
              onClick={() => onEdit(person.id)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium transition-colors duration-150 hover:bg-primary/5"
            >
              <Pencil aria-hidden className="size-4" />
              Edit profile
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
