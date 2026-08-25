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

/** Responsive surface: floating right card on ≥lg, bottom sheet below. */
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
      className={`absolute inset-x-3 top-21 bottom-3 z-30 flex flex-col rounded-2xl border border-border bg-surface shadow-card-raised transition-transform duration-300 ease-out sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-88 ${
        open ? "translate-x-0" : "translate-x-[calc(100%+1.5rem)]"
      }`}
    >
      {open && children}
    </aside>
  );
}
