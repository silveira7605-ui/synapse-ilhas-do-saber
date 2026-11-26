import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Kip } from "@/components/Kip";
import { cards, rescue, getIsland } from "@/lib/store";

export const Route = createFileRoute("/revisar")({
  validateSearch: (s: Record<string, unknown>): { ilha?: string } => (typeof s.ilha === "string" ? { ilha: s.ilha } : {}),
  head: () => ({ meta: [{ title: "Revisar hoje — Synapse" }, { name: "description", content: "Revise suas cartas do dia com o Kip." }, { property: "og:title", content: "Revisar hoje — Synapse" }, { property: "og:description", content: "Revise suas cartas do dia com o Kip." }] }),
  component: Review,
});

function Review() {
  const { ilha = "biologia" } = Route.useSearch();
  const name = getIsland(ilha)?.name ?? "Biologia";
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const done = i >= cards.length;
  const answer = () => { setFlip(false); setTimeout(() => { const n = i + 1; if (n >= cards.length) rescue(ilha); setI(n); }, 250); };

  if (done) return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative">
        <Kip size={140} className="animate-jump" />
        <div className="fog animate-fogaway absolute -inset-10 rounded-full" />
      </div>
      <h1 className="mt-6 text-4xl font-bold text-gold">Ilha resgatada! 🎉</h1>
      <p className="mt-2 text-muted-foreground">A névoa sumiu de {name}. Você arrasou demais 💖</p>
      <Link to="/" className="mt-8 w-full rounded-3xl bg-primary py-4 font-display text-lg font-bold text-primary-foreground">Voltar ao mapa</Link>
    </div>
  );

  const c = cards[i]!;
  const [a, b] = c.q.split("______");
  return (
    <div className="flex min-h-[85vh] flex-col px-4 pt-5">
      <div className="flex items-center justify-between text-sm font-bold"><span>🃏 {name}</span><span>{i + 1} de {cards.length} cartas</span></div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(i / cards.length) * 100}%` }} /></div>
      <div className="my-6 flex-1 [perspective:1200px]">
        <div className={`flip relative h-full min-h-80 ${flip ? "on" : ""}`}>
          <div className="face absolute inset-0 grid place-items-center rounded-[2rem] bg-card p-8 text-center text-2xl font-bold shadow-2xl">
            <p>{a}<span className="mx-1 inline-block w-24 border-b-4 border-dashed border-primary" />{b}</p>
          </div>
          <div className="face back absolute inset-0 grid place-items-center rounded-[2rem] bg-secondary p-8 text-center text-2xl font-bold shadow-2xl">
            <p>{a}<span className="mx-1 rounded-xl bg-gold px-2 text-navy">{c.a}</span>{b}</p>
          </div>
        </div>
      </div>
      {!flip ? (
        <button onClick={() => setFlip(true)} className="rounded-3xl bg-primary py-5 text-xl font-bold text-primary-foreground active:scale-95">Mostrar resposta</button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {["Errei 😵", "Quase 🤔", "Acertei 🎉"].map((l, k) => (
            <button key={l} onClick={answer} className={`rounded-3xl py-5 text-base font-bold active:scale-95 ${["bg-destructive text-destructive-foreground", "bg-secondary", "bg-gold text-navy"][k]}`}>{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}
