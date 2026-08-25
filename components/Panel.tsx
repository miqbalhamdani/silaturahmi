"use client";

import { useEffect, type ReactNode } from "react";

interface PanelProps {
  open: boolean;
  onClose: () => void;
  role: "complementary" | "dialog";
  label: string;
  /** CSS selector to return focus to on Escape */
  returnFocusTo?: string;
  children: ReactNode;
}

/** Responsive surface: full-screen modal on phones (<sm), floating right card ≥sm. */
export default function Panel({ open, onClose, role, label, returnFocusTo, children }: PanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        if (returnFocusTo)
          document.querySelector<HTMLElement>(returnFocusTo)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, returnFocusTo]);

  return (
    <aside
      role={role}
      aria-label={label}
      aria-hidden={!open}
      className={`absolute inset-0 z-30 flex flex-col bg-surface pb-[env(safe-area-inset-bottom)] shadow-card-raised transition-transform duration-300 ease-out sm:inset-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-88 sm:rounded-2xl sm:border sm:border-border sm:pb-0 ${
        open
          ? "translate-y-0 sm:translate-x-0"
          : "translate-y-full sm:translate-x-[calc(100%+1.5rem)] sm:translate-y-0"
      }`}
    >
      {open && children}
    </aside>
  );
}
