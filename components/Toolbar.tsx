"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Maximize,
  Minus,
  Moon,
  Plus,
  Sun,
  UserPlus,
} from "lucide-react";
import ShareButton from "./ShareButton";
import { LogoMark } from "./Logo";
import Link from "next/link";
import { Settings, LogIn } from "lucide-react";
import SearchBox from "./SearchBox";

export interface FamilyStats {
  members: number;
  generations: number;
  male: number;
  female: number;
}

interface ToolbarProps {
  familyName: string;
  /** Absent on the local demo tree at /. */
  familySlug?: string;
  isOwner?: boolean;
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

export default function Toolbar({ familyName, familySlug, isOwner = false, stats, scale, dark, onToggleDark, onZoom, onFit, onJumpTo, onAdd }: ToolbarProps) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

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
          <LogoMark className="size-7 shrink-0 text-primary" />
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

            {isOwner && familySlug && (
              <Link
                href={`/f/${familySlug}/settings`}
                className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-150 hover:bg-primary/5"
              >
                <Settings aria-hidden className="size-4" />
                Family settings
              </Link>
            )}

            {/* There is no landing page, so without this /login is only
                reachable by typing it. */}
            {!familySlug && (
              <Link
                href="/login"
                className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors duration-150 hover:bg-primary/5"
              >
                <LogIn aria-hidden className="size-4" />
                Sign in to build your own
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 1e — phones get the bottom MobileBar instead of these */}
      <div className="pointer-events-auto hidden min-w-44 flex-1 sm:block sm:max-w-72">
        <SearchBox id="person-search" onJumpTo={onJumpTo} />
      </div>

      <div className="pointer-events-auto ml-auto hidden items-center gap-1 rounded-xl border border-border bg-surface/90 p-1 shadow-card backdrop-blur sm:flex">
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
        <ShareButton familyName={familyName} className={iconBtn} />
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
