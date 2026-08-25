"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Maximize,
  Minus,
  Moon,
  Plus,
  Share2,
  Sun,
  TreeDeciduous,
  UserPlus,
} from "lucide-react";
import { familyName } from "@/lib/data";
import SearchBox from "./SearchBox";

export interface FamilyStats {
  members: number;
  generations: number;
  male: number;
  female: number;
}

interface ToolbarProps {
  stats: FamilyStats;
  scale: number;
  dark: boolean;
  onToggleDark: () => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onJumpTo: (personId: string) => void;
  onAdd: () => void;
}

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-primary/10 hover:text-foreground";

export default function Toolbar({ stats, scale, dark, onToggleDark, onZoom, onFit, onJumpTo, onAdd }: ToolbarProps) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

  async function shareFamily() {
    const payload = {
      title: "Silaturahmi",
      text: `${familyName} family tree`,
      url: window.location.origin + window.location.pathname,
    };
    if (navigator.share) {
      await navigator.share(payload).catch(() => {}); // user cancelling is fine
      return;
    }
    try {
      await navigator.clipboard.writeText(payload.url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      /* clipboard unavailable — nothing sane to do without a toast system */
    }
  }

  useEffect(() => {
    if (!overviewOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!overviewRef.current?.contains(e.target as Node)) setOverviewOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverviewOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [overviewOpen]);

  const rows: [string, number][] = [
    ["Family Members", stats.members],
    ["Generations", stats.generations],
    ["Male", stats.male],
    ["Female", stats.female],
  ];

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-3 p-4">
      <div ref={overviewRef} className="pointer-events-auto relative">
        <button
          type="button"
          aria-expanded={overviewOpen}
          aria-label="Family overview"
          onClick={() => setOverviewOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/90 py-2 pr-3 pl-3 text-left shadow-card backdrop-blur transition-colors duration-150 hover:bg-surface"
        >
          <TreeDeciduous aria-hidden className="size-6 text-primary" />
          <div>
            <h1 className="font-display text-lg leading-none font-semibold">Silaturahmi</h1>
            <p className="text-[11px] text-muted-foreground">{familyName} family tree</p>
          </div>
          <ChevronDown
            aria-hidden
            className={`size-4 text-muted-foreground transition-transform duration-200 ${overviewOpen ? "rotate-180" : ""}`}
          />
        </button>
        {overviewOpen && (
          <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-card-raised">
            <h2 className="font-display text-lg font-semibold">{familyName} Family</h2>
            <dl className="mt-3 space-y-1.5">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-display text-base font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="pointer-events-auto min-w-44 flex-1 sm:max-w-72">
        <SearchBox id="person-search" onJumpTo={onJumpTo} />
      </div>

      <div className="pointer-events-auto ml-auto flex items-center gap-1 rounded-xl border border-border bg-surface/90 p-1 shadow-card backdrop-blur">
        <button type="button" aria-label="Zoom out" className={iconBtn} onClick={() => onZoom(1 / 1.25)}>
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center text-xs font-semibold text-muted-foreground tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button type="button" aria-label="Zoom in" className={iconBtn} onClick={() => onZoom(1.25)}>
          <Plus className="size-4" />
        </button>
        <button type="button" aria-label="Fit tree to view" className={iconBtn} onClick={onFit}>
          <Maximize className="size-4" />
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          aria-label="Share family tree"
          className={iconBtn}
          onClick={shareFamily}
        >
          {shared ? <Check className="size-4 text-primary" /> : <Share2 className="size-4" />}
        </button>
        <span aria-live="polite" className="sr-only">
          {shared ? "Link copied to clipboard" : ""}
        </span>
        <button
          type="button"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className={iconBtn}
          onClick={onToggleDark}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button
          type="button"
          data-add-button
          onClick={onAdd}
          className="ml-1 flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90"
        >
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">Add person</span>
        </button>
      </div>
    </header>
  );
}
