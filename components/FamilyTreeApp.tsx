"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { people as seedPeople, unions as seedUnions } from "@/lib/data";
import {
  applyAddPerson,
  applyUpdatePerson,
  FamilyContext,
  type FamilyData,
  type PersonDraft,
  type PersonPatch,
} from "@/lib/family";
import { CARD_H, CARD_W, layoutTree } from "@/lib/layout";
import AddPersonPanel from "./AddPersonPanel";
import Canvas, { applyZoom, fitView, type View } from "./Canvas";
import DetailPanel from "./DetailPanel";
import Toolbar, { type FamilyStats } from "./Toolbar";

const PANEL_W = 352; // matches Panel sm:w-88

export default function FamilyTreeApp() {
  const [data, setData] = useState<FamilyData>({ people: seedPeople, unions: seedUnions });
  const layout = useMemo(() => layoutTree(data.people, data.unions), [data]);

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [dark, setDark] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const didInitialFit = useRef(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const family = useMemo(
    () => ({
      people: data.people,
      unions: data.unions,
      peopleById: new Map(data.people.map((p) => [p.id, p])),
      addPerson: (draft: PersonDraft) => {
        const result = applyAddPerson(data, draft);
        setData(result.data);
        return result.person;
      },
      updatePerson: (personId: string, patch: PersonPatch) => {
        setData(applyUpdatePerson(data, personId, patch));
      },
    }),
    [data],
  );

  const stats = useMemo<FamilyStats>(
    () => ({
      members: data.people.length,
      generations: Math.max(...[...layout.positions.values()].map((p) => p.gen)) + 1,
      male: data.people.filter((p) => p.gender === "male").length,
      female: data.people.filter((p) => p.gender === "female").length,
    }),
    [data, layout],
  );

  const stopAnimating = useCallback(() => {
    clearTimeout(animTimer.current);
    setAnimating(false);
  }, []);

  const animateTo = useCallback((next: View | ((v: View) => View)) => {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clearTimeout(animTimer.current);
      setAnimating(true);
      animTimer.current = setTimeout(() => setAnimating(false), 300);
    }
    setView(next);
  }, []);

  // frame the whole tree once on mount — later layout changes keep the viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (el && !didInitialFit.current) {
      didInitialFit.current = true;
      setView(fitView(layout.bounds, el.clientWidth, el.clientHeight));
    }
  }, [layout]);

  const jumpTo = useCallback(
    (personId: string) => {
      const el = viewportRef.current;
      const pos = layout.positions.get(personId);
      if (!el || !pos) return;
      setAddOpen(false);
      setEditId(null);
      setSelectedId(personId);
      // detail panel covers the right edge on ≥sm screens — center in the space left of it
      const panelW = window.innerWidth >= 640 ? PANEL_W : 0;
      animateTo((v) => {
        const scale = Math.max(v.scale, 0.8);
        return {
          scale,
          x: (el.clientWidth - panelW) / 2 - (pos.x + CARD_W / 2) * scale,
          y: el.clientHeight / 2 - (pos.y + CARD_H / 2) * scale,
        };
      });
    },
    [layout, animateTo],
  );

  // after a layout change from adding a person, center on them
  useEffect(() => {
    if (pendingFocus && layout.positions.has(pendingFocus)) {
      jumpTo(pendingFocus);
      setPendingFocus(null);
    }
  }, [layout, pendingFocus, jumpTo]);

  function onFit() {
    const el = viewportRef.current;
    if (el) animateTo(fitView(layout.bounds, el.clientWidth, el.clientHeight));
  }

  function onZoom(factor: number) {
    const el = viewportRef.current;
    if (el) animateTo((v) => applyZoom(v, el.clientWidth / 2, el.clientHeight / 2, factor));
  }

  function openAdd() {
    setSelectedId(null);
    setEditId(null);
    setAddOpen(true);
  }

  function openEdit(personId: string) {
    setAddOpen(false);
    setSelectedId(null);
    setEditId(personId);
  }

  function onSaved(personId: string) {
    setAddOpen(false);
    setEditId(null);
    setSelectedId(personId);
    setPendingFocus(personId);
  }

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <FamilyContext.Provider value={family}>
      {/* overflow-clip (not hidden): a focused element sliding off-screen must not scroll this container */}
      <div className="relative h-dvh w-full overflow-clip">
        <Canvas
          layout={layout}
          view={view}
          setView={setView}
          animating={animating}
          onUserInteract={stopAnimating}
          selectedId={selectedId}
          onSelect={(id) => {
            if (id) setAddOpen(false);
            setSelectedId(id);
          }}
          viewportRef={viewportRef}
        />
        <Toolbar
          stats={stats}
          scale={view.scale}
          dark={dark}
          onToggleDark={toggleDark}
          onZoom={onZoom}
          onFit={onFit}
          onJumpTo={jumpTo}
          onAdd={openAdd}
        />
        <DetailPanel
          personId={selectedId}
          onClose={() => setSelectedId(null)}
          onJumpTo={jumpTo}
          onEdit={openEdit}
        />
        <AddPersonPanel
          open={addOpen || editId !== null}
          editPersonId={editId}
          onClose={() => {
            setAddOpen(false);
            setEditId(null);
          }}
          onSaved={onSaved}
        />
      </div>
    </FamilyContext.Provider>
  );
}
