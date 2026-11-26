import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Kip, Fog } from "@/components/Kip";
import { useIslands, fogFromHealth, fogLabel, type Topic } from "@/lib/store";

export const Route = createFileRoute("/ilha/$id")({
  head: () => ({ meta: [{ title: "Ilha — Synapse" }, { name: "description", content: "Veja os tópicos da sua ilha e resgate ela da névoa." }, { property: "og:title", content: "Ilha — Synapse" }, { property: "og:description", content: "Veja os tópicos da sua ilha e resgate ela da névoa." }] }),
  component: IslandPage,
  notFoundComponent: () => <p className="p-6">Essa ilha sumiu no horizonte 🌊</p>,
});

const badge: Record<string, string> = { novo: "bg-secondary text-secondary-foreground", "em dia": "bg-gold text-navy", "revisão": "bg-primary text-primary-foreground" };
const badgeText: Record<string, string> = { novo: "novo", "em dia": "em dia", "revisão": "precisa de revisão" };

function Node({ t, depth = 0 }: { t: Topic; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const has = !!t.children?.length;
  return (
    <li>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded-2xl bg-card px-4 py-3 text-left font-sans font-bold" style={{ marginLeft: depth * 16, width: `calc(100% - ${depth * 16}px)` }}>
        <span className="w-4 text-muted-foreground">{has ? (open ? "▾" : "▸") : "•"}</span>
        <span className="flex-1">{t.name}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge[t.status]}`}>{badgeText[t.status]}</span>
      </button>
      {has && open && <ul className="mt-2 space-y-2">{t.children!.map((c) => <Node key={c.name} t={c} depth={depth + 1} />)}</ul>}
    </li>
  );
}

function IslandPage() {
  const { id } = Route.useParams();
  const isl = useIslands().find((i) => i.id === id);
  if (!isl) throw notFound();
  const f = fogFromHealth(isl.health);
  return (
    <div className="px-4 pt-5">
      <Link to="/" className="text-sm font-bold text-muted-foreground">← Voltar ao mapa</Link>
      <div className="mt-4 flex flex-col items-center text-center">
        <div className="relative grid h-36 w-36 place-items-center rounded-[45%_55%_50%_50%/55%_45%_55%_45%] text-6xl" style={{ background: isl.color }}>
          {isl.emoji}<Fog level={f} />
        </div>
        <h1 className="mt-3 text-3xl font-bold">{isl.name}</h1>
        <p className="mt-1 rounded-full bg-card px-3 py-1 text-sm font-bold">{fogLabel[f]}</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Kip size={44} className="animate-bob" />
          {f ? "Calma, a gente tira essa névoa juntinhos 💕" : "Tudo limpinho por aqui! Bora manter? ✨"}
        </div>
        <Link to="/revisar" search={{ ilha: isl.id }} className="mt-5 w-full rounded-3xl bg-gold py-5 font-display text-xl font-bold text-navy shadow-xl active:scale-95">
          {f ? "🛟 Resgatar a ilha" : "📚 Estudar hoje"}
        </Link>
      </div>
      <h2 className="mt-8 mb-3 text-xl font-semibold">Tópicos</h2>
      <ul className="space-y-2">{isl.topics.map((t) => <Node key={t.name} t={t} />)}</ul>
    </div>
  );
}
