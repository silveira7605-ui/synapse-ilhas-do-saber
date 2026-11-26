import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Kip, Fog } from "@/components/Kip";
import { KipMessage } from "@/components/KipMessage";
import { fetchIslands } from "@/lib/data";
import { born } from "@/lib/born";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Mapa do Arquipélago — Synapse" }, { name: "description", content: "Seu arquipélago de matérias. Resgate as ilhas da névoa com o Kip." }, { property: "og:title", content: "Mapa do Arquipélago — Synapse" }, { property: "og:description", content: "Seu arquipélago de matérias. Resgate as ilhas da névoa com o Kip." }] }),
  component: MapPage,
});

function MapPage() {
  const { data: islands, isLoading, isError, refetch } = useQuery({ queryKey: ["islands"], queryFn: fetchIslands, refetchOnMount: "always" });
  const [newborn] = useState(born.id);
  useEffect(() => { born.id = null; }, []);

  if (isLoading) return <KipMessage>Remando até o seu arquipélago... 🚣</KipMessage>;
  if (isError || !islands) return <KipMessage action={<button onClick={() => refetch()} className="w-full rounded-3xl bg-primary py-4 font-bold text-primary-foreground">Tentar de novo</button>}>Ops, o mar ficou agitado e não consegui ver suas ilhas. Vamos tentar de novo? 🌊</KipMessage>;

  const foggy = [...islands].filter((i) => i.fog > 0).sort((a, b) => b.pct - a.pct)[0];
  const msg = !islands.length ? "Bem-vindo! Vamos criar sua primeira ilha? 🌟"
    : foggy ? `A névoa chegou em ${foggy.name}! Bora resgatar? 🌫️`
    : "Seu arquipélago tá brilhando! Que orgulho 💖";
  const height = Math.max(520, 180 + islands.length * 150);

  return (
    <div className="px-4 pt-5">
      <div className="flex items-end gap-2">
        <Kip size={72} className="animate-bob shrink-0" />
        <div className="mb-6 rounded-3xl rounded-bl-md bg-card px-4 py-3 text-sm font-bold shadow-lg">{msg}</div>
      </div>
      {!islands.length ? (
        <div className="mt-16 flex flex-col items-center text-center text-muted-foreground">
          <div className="grid h-32 w-32 place-items-center rounded-full border-4 border-dashed border-border text-5xl">🏝️</div>
          <p className="mt-4 max-w-xs">Cole um texto, mande um PDF ou tire foto do caderno, e eu construo uma ilha pra você!</p>
        </div>
      ) : (
        <div className="relative mt-2 w-full" style={{ height }}>
          {islands.map((i) => (
            <Link key={i.id} to="/ilha/$id" params={{ id: i.id }}
              className={`absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-transform active:scale-95 ${newborn === i.id ? "animate-born" : ""}`}
              style={{ left: `${i.map_x}%`, top: i.map_y }}>
              <div className="relative grid h-24 w-24 place-items-center rounded-[45%_55%_50%_50%/55%_45%_55%_45%] text-4xl shadow-[0_0_30px_-5px] ring-4 ring-background/40" style={{ background: i.color, color: i.color }}>
                <span>{i.emoji}</span>
                <Fog level={i.fog} />
              </div>
              <span className="line-clamp-1 font-display text-base font-semibold text-foreground">{i.name}</span>
              <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gold" style={{ width: `${i.health}%` }} />
              </div>
            </Link>
          ))}
        </div>
      )}
      <Link to="/nova-ilha" className="fixed bottom-24 right-4 z-30 rounded-full bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-xl active:scale-95 md:right-[calc(50%-17rem)]">
        + Nova ilha
      </Link>
    </div>
  );
}
