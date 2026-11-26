// Pure study rules: spaced repetition, fog, cross-challenge mixing, streaks.
export type Rating = 1 | 2 | 3;
export type CardState = { interval_days: number; reps: number; lapses: number; last_review_at: string | null };
export const ACERTEI_STEPS = [1, 3, 7, 14, 30, 60];
const DAY = 86_400_000;

export function schedule(prev: CardState, rating: Rating, now = new Date()) {
  let { interval_days, reps, lapses } = prev;
  if (rating === 1) {
    interval_days = 1; reps = 0; lapses += 1;
  } else if (rating === 2) {
    interval_days = prev.last_review_at === null || prev.interval_days <= 0 ? 2 : round(prev.interval_days * 1.2);
  } else {
    reps += 1;
    interval_days = reps <= ACERTEI_STEPS.length ? ACERTEI_STEPS[reps - 1]! : round(prev.interval_days * 2.2);
  }
  return {
    interval_days, reps, lapses,
    last_review_at: now.toISOString(),
    due_at: new Date(now.getTime() + interval_days * DAY).toISOString(),
  };
}
const round = (n: number) => Math.round(n * 100) / 100;

export type Fog = 0 | 1 | 2 | 3;
/** % of overdue cards among cards studied at least once. */
export function overduePercent(states: { due_at: string; last_review_at: string | null }[], now = new Date()) {
  const studied = states.filter((s) => s.last_review_at !== null);
  if (!studied.length) return 0;
  const due = studied.filter((s) => new Date(s.due_at) <= now).length;
  return (due / studied.length) * 100;
}
export function fogLevel(pct: number): Fog {
  if (pct < 10) return 0;
  if (pct <= 30) return 1;
  if (pct <= 50) return 2;
  return 3;
}

/** Mix cards so no two consecutive share an island; due cards first within each island. */
export function crossMix<T extends { island_id: string; due: boolean }>(cards: T[], size = 12): T[] {
  const groups = new Map<string, T[]>();
  for (const c of cards) groups.set(c.island_id, [...(groups.get(c.island_id) ?? []), c]);
  for (const g of groups.values()) g.sort((a, b) => Number(b.due) - Number(a.due));
  const out: T[] = [];
  let last = "";
  while (out.length < size) {
    const options = [...groups.entries()].filter(([id, g]) => g.length && id !== last);
    if (!options.length) break;
    options.sort((a, b) => Number(b[1][0]!.due) - Number(a[1][0]!.due) || b[1].length - a[1].length);
    const [id, g] = options[0]!;
    out.push(g.shift()!);
    last = id;
  }
  return out;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** Consecutive days (ending today, or yesterday if today has none yet) with at least one review. */
export function streak(dates: (string | Date)[], now = new Date()) {
  const days = new Set(dates.map((d) => dayKey(new Date(d))));
  const cur = new Date(now);
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(cur))) { n++; cur.setDate(cur.getDate() - 1); }
  return n;
}

/** Spread island positions on the map without overlap: zig-zag rows. */
export function islandPosition(index: number) {
  const cols = [26, 72, 50];
  return { map_x: cols[index % 3]!, map_y: 90 + index * 150 };
}

export const ISLAND_COLORS_DEFAULT = [
  "var(--isle-green)",
  "var(--isle-amber)",
  "var(--isle-blue)",
  "var(--isle-pink)",
  "var(--isle-violet)",
];
