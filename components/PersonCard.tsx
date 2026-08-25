"use client";

import { initials } from "@/lib/data";
import { useFamily } from "@/lib/family";
import type { NodePos } from "@/lib/layout";

interface PersonCardProps {
  personId: string;
  pos: NodePos;
  width: number;
  height: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function PersonCard({ personId, pos, width, height, selected, onSelect }: PersonCardProps) {
  const person = useFamily().peopleById.get(personId)!;
  const years = person.deathYear
    ? `${person.birthYear} – ${person.deathYear}`
    : `b. ${person.birthYear}`;

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-person-id={personId}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onSelect(personId)}
      className={`absolute flex items-center gap-3 rounded-xl border bg-surface px-3.5 text-left transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card-raised ${
        selected
          ? "border-primary shadow-card-raised ring-2 ring-ring"
          : "border-border shadow-card"
      }`}
      style={{ left: pos.x, top: pos.y, width, height }}
    >
      <span
        aria-hidden
        className={`flex size-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold ${
          person.deathYear
            ? "bg-connector/25 text-muted-foreground"
            : "bg-primary/15 text-primary"
        }`}
      >
        {initials(person.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[15px] font-semibold leading-tight">
          {person.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{years}</span>
        <span className="mt-1 block text-[10px] font-semibold tracking-wide text-accent uppercase">
          Gen {pos.gen + 1}
        </span>
      </span>
    </button>
  );
}
