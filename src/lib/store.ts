import { useSyncExternalStore } from "react";

export type Fog = 0 | 1 | 2 | 3;
export type Status = "novo" | "em dia" | "revisão";
export type Topic = { name: string; status: Status; children?: Topic[] };
export type Island = { id: string; name: string; emoji: string; color: string; health: number; x: number; y: number; topics: Topic[] };

export const fogFromHealth = (h: number): Fog => (h >= 75 ? 0 : h >= 50 ? 1 : h >= 25 ? 2 : 3);
export const fogLabel = ["Sem névoa ☀️", "Névoa leve 🌤️", "Névoa densa 🌫️", "Sombra total 🌑"];

let islands: Island[] = [
  { id: "biologia", name: "Biologia", emoji: "🌿", color: "var(--isle-green)", health: 40, x: 28, y: 22,
    topics: [
      { name: "Célula", status: "revisão", children: [
        { name: "Mitocôndria", status: "revisão" }, { name: "Núcleo", status: "em dia" }, { name: "Membrana", status: "novo" } ] },
      { name: "Genética", status: "novo", children: [{ name: "DNA", status: "novo" }, { name: "Leis de Mendel", status: "novo" }] },
    ] },
  { id: "historia", name: "História", emoji: "🏛️", color: "var(--isle-amber)", health: 90, x: 72, y: 36,
    topics: [{ name: "Grécia Antiga", status: "em dia", children: [{ name: "Atenas", status: "em dia" }, { name: "Esparta", status: "em dia" }] }] },
  { id: "matematica", name: "Matemática", emoji: "🔢", color: "var(--isle-blue)", health: 60, x: 30, y: 58,
    topics: [{ name: "Funções", status: "revisão", children: [{ name: "1º grau", status: "em dia" }, { name: "2º grau", status: "revisão" }] }] },
  { id: "ingles", name: "Inglês", emoji: "💬", color: "var(--isle-pink)", health: 12, x: 70, y: 76,
    topics: [{ name: "Verbos", status: "revisão", children: [{ name: "Present Perfect", status: "revisão" }, { name: "Phrasal verbs", status: "novo" }] }] },
];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));

export const useIslands = () => useSyncExternalStore(subscribe, () => islands, () => islands);
export const getIsland = (id: string) => islands.find((i) => i.id === id);
export function rescue(id: string) {
  islands = islands.map((i) => (i.id === id ? { ...i, health: 100 } : i));
  emit();
}
export function addIsland(name: string) {
  const id = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "") + Date.now();
  islands = [...islands, { id, name, emoji: "🏝️", color: "var(--isle-violet)", health: 100, x: 50, y: 92,
    topics: [{ name: "Introdução", status: "novo", children: [{ name: "Conceitos básicos", status: "novo" }] }] }];
  emit();
  return id;
}

export const cards = [
  { q: "A ______ é a organela que produz energia na célula.", a: "mitocôndria" },
  { q: "O ______ guarda o material genético da célula.", a: "núcleo" },
  { q: "A ______ plasmática controla o que entra e sai da célula.", a: "membrana" },
  { q: "Os ______ são as organelas que fabricam proteínas.", a: "ribossomos" },
  { q: "Nas plantas, a fotossíntese acontece nos ______.", a: "cloroplastos" },
];
