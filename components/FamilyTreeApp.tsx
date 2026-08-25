"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAddPerson,
  applyUpdatePerson,
  FamilyContext,
  type FamilyContextValue,
  type FamilyData,
  type PersonDraft,
  type PersonPatch,
} from "@/lib/family";
import { CARD_H, CARD_W, layoutTree } from "@/lib/layout";
import {
  addPersonAction,
  createPhotoUploadUrl,
  updatePersonAction,
} from "@/lib/actions/family";
import { browserClient } from "@/lib/supabase/client";
import AddPersonPanel from "./AddPersonPanel";
import Canvas, { applyZoom, fitView, type View } from "./Canvas";
import DetailPanel from "./DetailPanel";
import MobileBar from "./MobileBar";
import Toolbar, { type FamilyStats } from "./Toolbar";

const PANEL_W = 352; // matches Panel sm:w-88
const MEDIA_BUCKET = "family-media";

interface FamilyTreeAppProps {
  initialData: FamilyData;
  familyName: string;
  /**
   * Present on /f/[slug]: writes go through Server Actions. Absent on /: the
   * canvas runs on the pure local reducers, exactly as it always has.
   */
  familySlug?: string;
  initialPersonSlug?: string;
  isOwner?: boolean;
}

export default function FamilyTreeApp({
  initialData,
  familyName,
  familySlug,
  initialPersonSlug,
  isOwner = false,
}: FamilyTreeAppProps) {
  const [data, setData] = useState<FamilyData>(initialData);
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

  const family = useMemo<FamilyContextValue>(
    () => ({
      people: data.people,
      unions: data.unions,
      peopleById: new Map(data.people.map((p) => [p.id, p])),

      // Server mode replaces the whole graph with what the DB returned rather
      // than merging: no id reconciliation to get wrong, and concurrent edits
      // by other people show up on the next write.
      addPerson: async (draft: PersonDraft) => {
        if (!familySlug) {
          const result = applyAddPerson(data, draft);
          setData(result.data);
          return result.person;
        }
        const { data: fresh, personSlug } = await addPersonAction(familySlug, draft);
        setData(fresh);
        const created = fresh.people.find((p) => p.id === personSlug);
        if (!created) throw new Error("The new person was not returned by the server.");
        return created;
      },

      updatePerson: async (personId: string, patch: PersonPatch) => {
        if (!familySlug) {
          setData(applyUpdatePerson(data, personId, patch));
          return;
        }
        setData(await updatePersonAction(familySlug, personId, patch));
      },

      uploadPhoto: async (file: File) => {
        if (!familySlug) {
          // Local mode has nowhere to put bytes, so the data URL is the value.
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Could not read that file."));
            reader.readAsDataURL(file);
          });
          return { photoUrl: dataUrl };
        }

        const { path, token } = await createPhotoUploadUrl(familySlug, file.type, file.size);
        const { error } = await browserClient()
          .storage.from(MEDIA_BUCKET)
          .uploadToSignedUrl(path, token, file);
        // The bucket enforces size and MIME itself, so this catches a real
        // rejection rather than a guess the client made.
        if (error) throw new Error(error.message);

        // Preview from the local file: instant, and no signed URL to mint.
        return { photoUrl: URL.createObjectURL(file), photoKey: path };
      },
    }),
    [data, familySlug],
  );

  const stats = useMemo<FamilyStats>(
    () => ({
      members: data.people.length,
      // Math.max(...[]) is -Infinity — a family can legitimately be empty.
      generations: layout.positions.size
        ? Math.max(...[...layout.positions.values()].map((p) => p.gen)) + 1
        : 0,
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
      // ≥sm the detail panel covers the right edge — center in the space left
      // of it. On phones the modal is full-screen, so center in the whole
      // viewport for when it closes.
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

  // ?person=<slug> deep link. Runs once: didDeepLink stops a later layout
  // change from yanking the view back to the shared person.
  const didDeepLink = useRef(false);
  useEffect(() => {
    if (didDeepLink.current || !initialPersonSlug) return;
    if (!layout.positions.has(initialPersonSlug)) return;
    didDeepLink.current = true;
    didInitialFit.current = true; // the deep link IS the initial view
    jumpTo(initialPersonSlug);
  }, [layout, initialPersonSlug, jumpTo]);

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
          familyName={familyName}
          familySlug={familySlug}
          isOwner={isOwner}
          stats={stats}
          scale={view.scale}
          dark={dark}
          onToggleDark={toggleDark}
          onZoom={onZoom}
          onFit={onFit}
          onJumpTo={jumpTo}
          onAdd={openAdd}
        />
        <MobileBar
          familyName={familyName}
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
