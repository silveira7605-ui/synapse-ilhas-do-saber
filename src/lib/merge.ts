import type { ChunkResult } from "./island.functions";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** Merge chunk results: keys namespaced per chunk, repeated concepts (same title & depth) collapsed, duplicate cards dropped. */
export function mergeChunks(results: ChunkResult[]) {
  const concepts: ChunkResult["concepts"] = [];
  const cards: ChunkResult["cards"] = [];
  const byTitle = new Map<string, string>();
  const seenCards = new Set<string>();
  results.forEach((r, i) => {
    const remap = new Map<string, string>();
    const ordered = [...r.concepts].sort((a, b) => a.depth - b.depth);
    for (const c of ordered) {
      const sig = `${c.depth}:${norm(c.title)}`;
      const existing = byTitle.get(sig);
      if (existing) { remap.set(c.key, existing); continue; }
      const key = `k${i}_${c.key}`;
      remap.set(c.key, key);
      byTitle.set(sig, key);
      concepts.push({ ...c, key, parent_key: c.parent_key ? remap.get(c.parent_key) ?? null : null });
    }
    for (const c of r.cards) {
      const sig = norm(c.front);
      if (seenCards.has(sig)) continue;
      seenCards.add(sig);
      cards.push({ ...c, concept_key: remap.get(c.concept_key) ?? c.concept_key });
    }
  });
  return { concepts, cards };
}
