import { describe, expect, it } from "vitest";
import { schedule, fogLevel, overduePercent, crossMix, streak } from "./srs";

const fresh = { interval_days: 0, reps: 0, lapses: 0, last_review_at: null };
const now = new Date("2026-11-26T12:00:00Z");

describe("repetição espaçada", () => {
  it("Errei volta amanhã e zera a sequência", () => {
    const r = schedule({ interval_days: 14, reps: 4, lapses: 0, last_review_at: "x" }, 1, now);
    expect(r.interval_days).toBe(1);
    expect(r.reps).toBe(0);
    expect(r.lapses).toBe(1);
  });
  it("Quase: 2 dias na primeira vez, depois ×1,2", () => {
    expect(schedule(fresh, 2, now).interval_days).toBe(2);
    expect(schedule({ interval_days: 10, reps: 2, lapses: 0, last_review_at: "x" }, 2, now).interval_days).toBe(12);
  });
  it("Acertei segue 1,3,7,14,30,60 e depois ×2,2", () => {
    let s: { interval_days: number; reps: number; lapses: number; last_review_at: string | null } = fresh;
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) { s = schedule(s, 3, now); seen.push(s.interval_days); }
    expect(seen).toEqual([1, 3, 7, 14, 30, 60, 132]);
  });
});

describe("névoa", () => {
  it("faixas 10/30/50", () => {
    expect(fogLevel(9.9)).toBe(0);
    expect(fogLevel(10)).toBe(1);
    expect(fogLevel(30)).toBe(1);
    expect(fogLevel(45)).toBe(2);
    expect(fogLevel(51)).toBe(3);
  });
  it("ilha sem nada estudado não tem névoa", () => {
    expect(overduePercent([{ due_at: "2020-01-01", last_review_at: null }], now)).toBe(0);
  });
  it("conta só cartas já estudadas", () => {
    const p = overduePercent([
      { due_at: "2020-01-01", last_review_at: "x" },
      { due_at: "2030-01-01", last_review_at: "x" },
      { due_at: "2020-01-01", last_review_at: null },
    ], now);
    expect(p).toBe(50);
  });
});

describe("desafio cruzado", () => {
  it("nunca repete ilha em seguida e prioriza vencidas", () => {
    const cards = [
      ...Array.from({ length: 10 }, (_, i) => ({ island_id: "a", due: i < 2 })),
      ...Array.from({ length: 5 }, () => ({ island_id: "b", due: false })),
      ...Array.from({ length: 5 }, () => ({ island_id: "c", due: true })),
    ];
    const out = crossMix(cards, 12);
    expect(out).toHaveLength(12);
    for (let i = 1; i < out.length; i++) expect(out[i]!.island_id).not.toBe(out[i - 1]!.island_id);
    expect(out[0]!.due).toBe(true);
  });
});

describe("sequência de dias", () => {
  it("conta dias seguidos", () => {
    const d = (n: number) => new Date(now.getTime() - n * 86400000);
    expect(streak([d(0), d(1), d(2), d(4)], now)).toBe(3);
    expect(streak([d(1), d(2)], now)).toBe(2);
    expect(streak([d(3)], now)).toBe(0);
  });
});
