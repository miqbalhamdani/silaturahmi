"use client";

import { useState } from "react";
import { Maximize, Minus, Moon, Plus, Search, Sun, UserPlus, X } from "lucide-react";
import SearchBox from "./SearchBox";
import ShareButton from "./ShareButton";

interface MobileBarProps {
  familyName: string;
  dark: boolean;
  onToggleDark: () => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onJumpTo: (personId: string) => void;
  onAdd: () => void;
}

const btn =
  "flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-200 hover:bg-primary/10 hover:text-foreground";

/** 1e — phone chrome: bottom toolbar with a drop-up search row. */
export default function MobileBar({
  familyName,
  dark,
  onToggleDark,
  onZoom,
  onFit,
  onJumpTo,
  onAdd,
}: MobileBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 sm:hidden">
      {searchOpen && (
        <div className="border-t border-border bg-surface p-3">
          <SearchBox
            id="person-search-m"
            dropUp
            onJumpTo={(id) => {
              setSearchOpen(false);
              onJumpTo(id);
            }}
          />
        </div>
      )}
      <div className="flex items-center justify-around border-t border-border bg-surface px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label={searchOpen ? "Close search" : "Search family members"}
          aria-expanded={searchOpen}
          className={btn}
          onClick={() => setSearchOpen((o) => !o)}
        >
          {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
        </button>
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => onZoom(1 / 1.25)}>
          <Minus className="size-5" />
        </button>
        <button type="button" aria-label="Zoom in" className={btn} onClick={() => onZoom(1.25)}>
          <Plus className="size-5" />
        </button>
        <button type="button" aria-label="Fit tree to view" className={btn} onClick={onFit}>
          <Maximize className="size-5" />
        </button>
        <ShareButton familyName={familyName} className={btn} />
        <button
          type="button"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className={btn}
          onClick={onToggleDark}
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <button
          type="button"
          aria-label="Add person"
          data-add-button
          onClick={onAdd}
          className="flex size-11 items-center justify-center rounded-xl bg-primary text-on-primary transition-opacity duration-200 hover:opacity-90"
        >
          <UserPlus className="size-5" />
        </button>
      </div>
    </div>
  );
}
