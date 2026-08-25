"use client";

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { CARD_H, CARD_W, type TreeLayout } from "@/lib/layout";
import PersonCard from "./PersonCard";

export interface View {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2.5;


const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Zoom about a viewport point, keeping the world point under it fixed. */
export function applyZoom(v: View, cx: number, cy: number, factor: number): View {
  let scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
  if (Math.abs(scale - 1) < 0.02) scale = 1; // snap for crisp text
  return {
    scale,
    x: cx - ((cx - v.x) / v.scale) * scale,
    y: cy - ((cy - v.y) / v.scale) * scale,
  };
}

/** View that frames the whole tree with padding, centered in the viewport. */
export function fitView(bounds: TreeLayout["bounds"], vw: number, vh: number): View {
  const PAD = 72;
  const scale = clamp(
    Math.min((vw - PAD * 2) / bounds.w, (vh - PAD * 2) / bounds.h),
    MIN_SCALE,
    1.25,
  );
  return {
    scale,
    x: (vw - bounds.w * scale) / 2 - bounds.x * scale,
    y: (vh - bounds.h * scale) / 2 - bounds.y * scale,
  };
}

interface CanvasProps {
  layout: TreeLayout;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  animating: boolean;
  onUserInteract: () => void; // cancels programmatic transitions
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export default function Canvas({
  layout,
  view,
  setView,
  animating,
  onUserInteract,
  selectedId,
  onSelect,
  viewportRef,
}: CanvasProps) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: number } | null>(null);

  // wheel must be a native non-passive listener — React's root wheel
  // listener is passive, so preventDefault in onWheel is ignored
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onUserInteract();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
      setView((v) => applyZoom(v, e.clientX - rect.left, e.clientY - rect.top, factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setView, onUserInteract, viewportRef]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    onUserInteract();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1)
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: 0 };
    else drag.current = null; // second finger down → pinch, not pan
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const pts = pointers.current;

    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const other = a === prev ? b : a;
      const dist = (p: { x: number; y: number }, q: { x: number; y: number }) =>
        Math.hypot(p.x - q.x, p.y - q.y);
      const oldD = dist(prev, other);
      const cur = { x: e.clientX, y: e.clientY };
      const newD = dist(cur, other);
      const rect = e.currentTarget.getBoundingClientRect();
      const mid = { x: (cur.x + other.x) / 2 - rect.left, y: (cur.y + other.y) / 2 - rect.top };
      if (oldD > 0) setView((v) => applyZoom(v, mid.x, mid.y, newD / oldD));
    } else if (drag.current) {
      const d = drag.current;
      d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.x, e.clientY - d.y));
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (drag.current && drag.current.moved < 5) onSelect(null); // background click
    drag.current = null;
  }

  const dot = 24 * view.scale;

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 touch-none overflow-hidden bg-background"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        backgroundImage: "radial-gradient(var(--border) 1.5px, transparent 1.5px)",
        backgroundSize: `${dot}px ${dot}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: animating ? "transform 250ms ease-out" : "none",
        }}
      >
        <svg
          className="absolute top-0 left-0 overflow-visible"
          width={Math.max(1, layout.bounds.w)}
          height={Math.max(1, layout.bounds.h)}
          aria-hidden
        >
          {layout.childEdges.map((d, i) => (
            <path key={`c${i}`} d={d} fill="none" stroke="var(--connector)" strokeWidth={1.5} />
          ))}
          {layout.coupleEdges.map((d, i) => (
            <path key={`m${i}`} d={d} fill="none" stroke="var(--connector)" strokeWidth={2.5} />
          ))}
        </svg>
        {[...layout.positions.entries()].map(([id, pos]) => (
          <PersonCard
            key={id}
            personId={id}
            pos={pos}
            width={CARD_W}
            height={CARD_H}
            selected={id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
