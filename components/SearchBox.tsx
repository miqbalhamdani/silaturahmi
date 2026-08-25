"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useFamily } from "@/lib/family";

interface SearchBoxProps {
  id: string;
  dropUp?: boolean;
  onJumpTo: (personId: string) => void;
}

export default function SearchBox({ id, dropUp, onJumpTo }: SearchBoxProps) {
  const { people } = useFamily();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const matches =
    focused && query.trim()
      ? people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
      : [];

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search family members
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id={id}
        type="search"
        placeholder="Find a family member…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm placeholder:text-muted-foreground"
      />
      {matches.length > 0 && (
        <ul
          className={`absolute inset-x-0 z-40 overflow-hidden rounded-xl border border-border bg-surface shadow-card-raised ${
            dropUp ? "bottom-full mb-2" : "top-12"
          }`}
        >
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-primary/10"
                onClick={() => {
                  onJumpTo(p.id);
                  setQuery("");
                }}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.deathYear ? `${p.birthYear}–${p.deathYear}` : `b. ${p.birthYear}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
