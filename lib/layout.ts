import type { Person, Union } from "./types";

export const CARD_W = 212;
export const CARD_H = 92;
const COUPLE_GAP = 28;
const SIBLING_GAP = 48;
export const GEN_GAP = 172; // row pitch (card top to next card top)

export interface NodePos {
  x: number;
  y: number;
  gen: number;
}

export interface TreeLayout {
  positions: Map<string, NodePos>;
  coupleEdges: string[]; // SVG paths joining partners
  childEdges: string[]; // SVG paths: couple midpoint → bus → children
  bounds: { x: number; y: number; w: number; h: number };
}

// ponytail: band-allocation tidy tree — each subtree owns a contiguous
// horizontal band, so overlap is impossible. Wastes width on very uneven
// sibling subtrees; upgrade to Reingold–Tilford contours if that ever shows.

export function layoutTree(people: Person[], unions: Union[]): TreeLayout {
  const unionByPartner = new Map<string, Union>();
  const childToUnion = new Set<string>();
  for (const u of unions) {
    for (const p of u.partners) unionByPartner.set(p, u);
    for (const c of u.children) childToUnion.add(c);
  }
  const widthMemo = new Map<string, number>();

  function subtreeWidth(personId: string): number {
    const u = unionByPartner.get(personId);
    return u ? unionWidth(u) : CARD_W;
  }

  function unionWidth(u: Union): number {
    const memo = widthMemo.get(u.id);
    if (memo !== undefined) return memo;
    const coupleW = 2 * CARD_W + COUPLE_GAP;
    const w = Math.max(coupleW, childrenWidth(u));
    widthMemo.set(u.id, w);
    return w;
  }

  function childrenWidth(u: Union): number {
    if (u.children.length === 0) return 0;
    return (
      u.children.reduce((s, c) => s + subtreeWidth(c), 0) +
      SIBLING_GAP * (u.children.length - 1)
    );
  }

  const positions = new Map<string, NodePos>();

  function placeUnion(u: Union, xLeft: number, gen: number) {
    const w = unionWidth(u);
    const cx = xLeft + w / 2;
    const y = gen * GEN_GAP;
    positions.set(u.partners[0], { x: cx - COUPLE_GAP / 2 - CARD_W, y, gen });
    positions.set(u.partners[1], { x: cx + COUPLE_GAP / 2, y, gen });

    let x = xLeft + (w - childrenWidth(u)) / 2;
    for (const c of u.children) {
      const cw = subtreeWidth(c);
      const cu = unionByPartner.get(c);
      if (cu) placeUnion(cu, x, gen + 1);
      else positions.set(c, { x: x + cw / 2 - CARD_W / 2, y: (gen + 1) * GEN_GAP, gen: gen + 1 });
      x += cw + SIBLING_GAP;
    }
  }

  const root = unions.find((u) => u.partners.every((p) => !childToUnion.has(p)));
  // No unions at all is a legitimate brand-new family — the wizard creates one
  // person and no union. Only a union set with no root among it is broken.
  if (!root && unions.length) throw new Error("no root union found");
  if (root) placeUnion(root, 0, 0);

  // Anyone the root subtree never reached: the wizard's first person before a
  // union exists, and any stray second root, which should be visible rather
  // than silently missing from the canvas.
  const placedRight = () =>
    positions.size ? Math.max(...[...positions.values()].map((p) => p.x + CARD_W)) : 0;
  let orphanX = positions.size ? placedRight() + SIBLING_GAP : 0;
  for (const p of people) {
    if (positions.has(p.id)) continue;
    const u = unionByPartner.get(p.id);
    if (u && !positions.has(u.partners[0]) && !positions.has(u.partners[1])) {
      placeUnion(u, orphanX, 0);
    } else if (!u) {
      positions.set(p.id, { x: orphanX, y: 0, gen: 0 });
    } else {
      continue; // partner already placed this union
    }
    orphanX = placedRight() + SIBLING_GAP;
  }

  const coupleEdges: string[] = [];
  const childEdges: string[] = [];
  for (const u of unions) {
    const a = positions.get(u.partners[0]);
    const b = positions.get(u.partners[1]);
    if (!a || !b) continue; // partner missing from this family's people
    const midY = a.y + CARD_H / 2;
    coupleEdges.push(`M ${a.x + CARD_W} ${midY} H ${b.x}`);
    if (u.children.length === 0) continue;

    const mx = (a.x + CARD_W + b.x) / 2;
    const busY = a.y + CARD_H + (GEN_GAP - CARD_H) / 2;
    const placedChildren = u.children.filter((c) => positions.has(c));
    if (placedChildren.length === 0) continue;
    const centers = placedChildren.map((c) => positions.get(c)!.x + CARD_W / 2);
    const childY = positions.get(placedChildren[0])!.y;
    let d = `M ${mx} ${midY} V ${busY}`;
    d += ` M ${Math.min(...centers, mx)} ${busY} H ${Math.max(...centers, mx)}`;
    for (const cxc of centers) d += ` M ${cxc} ${busY} V ${childY}`;
    childEdges.push(d);
  }

  const xs = [...positions.values()];
  // Math.min(...[]) is Infinity, which would poison every fit-to-view sum.
  if (xs.length === 0)
    return { positions, coupleEdges, childEdges, bounds: { x: 0, y: 0, w: 0, h: 0 } };
  const minX = Math.min(...xs.map((p) => p.x));
  const maxX = Math.max(...xs.map((p) => p.x + CARD_W));
  const maxY = Math.max(...xs.map((p) => p.y + CARD_H));
  return {
    positions,
    coupleEdges,
    childEdges,
    bounds: { x: minX, y: 0, w: maxX - minX, h: maxY },
  };
}

// self-check: npx tsx lib/layout.ts
if (typeof process !== "undefined" && process.argv[1]?.endsWith("layout.ts")) {
  import("./data").then(({ people, unions }) => {
    const { positions, coupleEdges, childEdges } = layoutTree(people, unions);
    const entries = [...positions.entries()];
    console.assert(entries.length === people.length, "every person placed");
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++) {
        const [ida, a] = entries[i];
        const [idb, b] = entries[j];
        const overlap =
          Math.abs(a.x - b.x) < CARD_W && Math.abs(a.y - b.y) < CARD_H;
        console.assert(!overlap, `overlap: ${ida} vs ${idb}`);
      }
    for (const u of unions) {
      if (u.children.length === 0) continue;
      const a = positions.get(u.partners[0])!;
      const b = positions.get(u.partners[1])!;
      const mx = (a.x + CARD_W + b.x) / 2;
      const cs = u.children.map((c) => positions.get(c)!.x + CARD_W / 2);
      // drop point must land within the children bus span
      console.assert(
        mx >= Math.min(...cs) - 1 && mx <= Math.max(...cs) + 1,
        `union ${u.id}: drop point misses bus`,
      );
    }
    // childless union renders a couple line and no child bus
    const spouseAdded = layoutTree(
      [...people, { id: "x", name: "X Y", birthYear: 1970 }],
      [...unions, { id: "u-x", partners: ["hasan", "x"] as [string, string], children: [] }],
    );
    console.assert(spouseAdded.coupleEdges.length === coupleEdges.length + 1, "extra couple edge");
    console.assert(spouseAdded.childEdges.length === childEdges.length, "no extra child edge");

    // the family wizard's output: one person, no unions. This threw before.
    const lone = layoutTree([{ id: "solo", name: "Solo Person", birthYear: 1980 }], []);
    console.assert(lone.positions.size === 1, "lone person placed");
    console.assert(lone.bounds.w === CARD_W, `lone bounds width ${lone.bounds.w}`);

    // an empty family must not produce Infinity bounds
    const none = layoutTree([], []);
    console.assert(none.bounds.w === 0 && none.bounds.h === 0, "empty bounds are zero");

    console.log("layout self-check passed:", entries.length, "people placed");
  });
}
