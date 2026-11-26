import { supabase } from "@/integrations/supabase/client";
import { fogLevel, overduePercent, type Fog } from "./srs";

export type IslandView = {
  id: string; name: string; emoji: string; color: string; map_x: number; map_y: number;
  pct: number; fog: Fog; health: number; due: number; total: number;
};
export type CardRow = {
  id: string; island_id: string; concept_id: string | null; type: string; front: string; back: string; source_quote: string | null;
  state: { due_at: string; interval_days: number; reps: number; lapses: number; last_review_at: string | null } | null;
};

export async function fetchCards(islandId?: string): Promise<CardRow[]> {
  let q = supabase.from("cards").select("id, island_id, concept_id, type, front, back, source_quote, card_states(due_at, interval_days, reps, lapses, last_review_at)").eq("reported", false);
  if (islandId) q = q.eq("island_id", islandId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(({ card_states, ...c }: any) => ({ ...c, state: card_states?.[0] ?? null }));
}

export const isDue = (c: CardRow, now = new Date()) => !c.state || new Date(c.state.due_at) <= now;

export async function fetchIslands(): Promise<IslandView[]> {
  const [{ data: islands, error }, cards] = await Promise.all([
    supabase.from("islands").select("*").order("created_at"),
    fetchCards(),
  ]);
  if (error) throw error;
  return (islands ?? []).map((i) => {
    const mine = cards.filter((c) => c.island_id === i.id);
    const states = mine.map((c) => c.state ?? { due_at: new Date().toISOString(), last_review_at: null });
    const pct = overduePercent(states);
    return { ...i, pct, fog: fogLevel(pct), health: Math.round(100 - pct), due: mine.filter((c) => isDue(c)).length, total: mine.length };
  });
}

export const fogLabel = ["Sem névoa ☀️", "Névoa leve 🌤️", "Névoa densa 🌫️", "Sombra total 🌑"];
export const ISLAND_COLORS = ["var(--isle-green)", "var(--isle-amber)", "var(--isle-blue)", "var(--isle-pink)", "var(--isle-violet)"];
