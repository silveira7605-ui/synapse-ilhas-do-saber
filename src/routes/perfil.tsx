import { createFileRoute } from "@tanstack/react-router";
import { Kip } from "@/components/Kip";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Synapse" }, { name: "description", content: "Seu perfil e sua sequência de estudos." }, { property: "og:title", content: "Perfil — Synapse" }, { property: "og:description", content: "Seu perfil e sua sequência de estudos." }] }),
  component: Profile,
});
function Profile() {
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];
  return (
    <div className="flex flex-col items-center px-4 pt-10 text-center">
      <Kip size={120} className="animate-bob" />
      <h1 className="mt-4 text-3xl font-bold">Roger</h1>
      <p className="text-muted-foreground">Explorador do arquipélago 🧭</p>
      <div className="mt-6 w-full rounded-[2rem] bg-card p-6">
        <p className="font-display text-3xl font-bold text-gold">🔥 5 dias seguidos</p>
        <div className="mt-4 flex justify-between">
          {days.map((d, k) => <div key={k} className={`grid h-10 w-10 place-items-center rounded-full font-bold ${k < 5 ? "bg-gold text-navy" : "bg-muted text-muted-foreground"}`}>{d}</div>)}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Cada diazinho conta. Tô muito orgulhoso de você! 💖</p>
      </div>
    </div>
  );
}
