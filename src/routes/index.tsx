import { createFileRoute, Link } from "@tanstack/react-router";
import { Kip, Fog } from "@/components/Kip";
import { useIslands, fogFromHealth } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Mapa do Arquipélago — Synapse" }, { name: "description", content: "Seu arquipélago de matérias. Resgate as ilhas da névoa com o Kip." }, { property: "og:title", content: "Mapa do Arquipélago — Synapse" }, { property: "og:description", content: "Seu arquipélago de matérias. Resgate as ilhas da névoa com o Kip." }] }),
  component: MapPage,
});

function MapPage() {
  const islands = useIslands();
  const foggy = [...islands].sort((a, b) => a.health - b.health)[0];
  const msg = foggy && foggy.health < 50 ? `A névoa chegou em ${foggy.name}! Bora resgatar? 🌫️` : "Seu arquipélago tá brilhando! Que orgulho 💖";
  return (
    <div className="px-4 pt-5">
      <div className="flex items-end gap-2">
        <Kip size={72} className="animate-bob shrink-0" />
        <div className="relative mb-6 rounded-3xl rounded-bl-md bg-card px-4 py-3 text-sm font-bold shadow-lg">{msg}</div>
      </div>
      <div className="relative mt-2 w-full" style={{ height: `${Math.max(560, islands.length * 140)}px` }}>
        {islands.map((i) => {
          const f = fogFromHealth(i.health);
          return (
            <Link key={i.id} to="/ilha/$id" params={{ id: i.id }}
              className="absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-transform active:scale-95"
              style={{ left: `${i.x}%`, top: `${(i.y / 100) * 85 + 5}%` }}>
              <div className="relative grid h-24 w-24 place-items-center rounded-[45%_55%_50%_50%/55%_45%_55%_45%] text-4xl shadow-[0_0_30px_-5px] ring-4 ring-background/40"
                style={{ background: i.color, color: i.color }}>
                <span>{i.emoji}</span>
                <Fog level={f} />
              </div>
              <span className="font-display text-base font-semibold text-foreground">{i.name}</span>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gold" style={{ width: `${i.health}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
      <Link to="/nova-ilha" className="fixed bottom-24 right-4 z-30 rounded-full bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-xl active:scale-95 md:right-[calc(50%-17rem)]">
        + Nova ilha
      </Link>
    </div>
  );
}
