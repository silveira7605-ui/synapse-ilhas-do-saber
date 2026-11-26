import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Kip } from "@/components/Kip";
import { addIsland } from "@/lib/store";

export const Route = createFileRoute("/nova-ilha")({
  head: () => ({ meta: [{ title: "Nova ilha — Synapse" }, { name: "description", content: "Crie uma nova ilha a partir do seu material de estudo." }, { property: "og:title", content: "Nova ilha — Synapse" }, { property: "og:description", content: "Crie uma nova ilha a partir do seu material de estudo." }] }),
  component: NewIsland,
});
const phrases = ["Lendo seu material...", "Construindo a ilha...", "Criando suas cartas..."];

function NewIsland() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setP((x) => (x + 1) % phrases.length), 1330);
    const d = setTimeout(() => { addIsland(name.trim() || "Ilha Nova"); nav({ to: "/" }); }, 4000);
    return () => { clearInterval(t); clearTimeout(d); };
  }, [loading]);

  if (loading) return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
      <Kip size={130} className="animate-jump" />
      <p key={p} className="mt-6 animate-in fade-in font-display text-2xl font-semibold">{phrases[p]}</p>
    </div>
  );
  return (
    <div className="space-y-4 px-4 pt-6">
      <h1 className="text-3xl font-bold">Nova ilha 🏝️</h1>
      <p className="text-muted-foreground">Me conta o que você vai estudar que eu monto tudo pra você 💕</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da matéria (ex.: Química)"
        className="w-full rounded-3xl border border-input bg-card px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-ring" />
      <textarea rows={8} placeholder="Cole aqui o texto do seu material de estudo..."
        className="w-full rounded-3xl border border-input bg-card px-5 py-4 outline-none focus:ring-2 focus:ring-ring" />
      <button type="button" className="w-full rounded-3xl border-2 border-dashed border-primary py-4 font-bold text-primary">📄 Enviar PDF</button>
      <button onClick={() => setLoading(true)} className="w-full rounded-3xl bg-gold py-5 text-xl font-bold text-navy shadow-xl active:scale-95">✨ Criar minha ilha</button>
    </div>
  );
}
