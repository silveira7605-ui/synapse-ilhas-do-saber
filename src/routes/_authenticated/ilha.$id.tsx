import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Kip, Fog } from "@/components/Kip";
import { KipMessage } from "@/components/KipMessage";
import { fetchCards, fetchIslands, fogLabel, isDue, type CardRow } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/ilha/$id")({
  head: () => ({ meta: [{ title: "Ilha — Synapse" }, { name: "description", content: "Veja os conceitos da sua ilha e resgate ela da névoa." }, { property: "og:title", content: "Ilha — Synapse" }, { property: "og:description", content: "Veja os conceitos da sua ilha e resgate ela da névoa." }] }),
  component: IslandPage,
});

type Concept = { id: string; parent_id: string | null; title: string; summary: string | null; source_quote: string | null; depth: number };
type Status = "novo" | "em dia" | "revisão";
const badge: Record<Status, string> = { novo: "bg-secondary text-secondary-foreground", "em dia": "bg-gold text-navy", "revisão": "bg-primary text-primary-foreground" };
const badgeText: Record<Status, string> = { novo: "novo", "em dia": "em dia", "revisão": "precisa de revisão" };

function statusOf(cards: CardRow[]): Status {
  const studied = cards.filter((c) => c.state?.last_review_at);
  if (!studied.length) return "novo";
  return studied.some((c) => isDue(c)) ? "revisão" : "em dia";
}

function Node({ c, all, cards, depth = 0 }: { c: Concept; all: Concept[]; cards: CardRow[]; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const [info, setInfo] = useState(false);
  const [quote, setQuote] = useState(false);
  const kids = all.filter((k) => k.parent_id === c.id);
  const subtree = (id: string): string[] => [id, ...all.filter((k) => k.parent_id === id).flatMap((k) => subtree(k.id))];
  const ids = new Set(subtree(c.id));
  const st = statusOf(cards.filter((k) => k.concept_id && ids.has(k.concept_id)));
  return (
    <li style={{ marginLeft: depth ? 14 : 0 }}>
      <div className="flex items-center gap-1 rounded-2xl bg-card pr-3">
        <button aria-label={open ? "Recolher" : "Expandir"} onClick={() => setOpen(!open)} className="w-10 self-stretch text-muted-foreground" disabled={!kids.length}>
          {kids.length ? (open ? "▾" : "▸") : "•"}
        </button>
        <button onClick={() => setInfo(!info)} className="flex-1 py-3 text-left font-sans font-bold">{c.title}</button>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge[st]}`}>{badgeText[st]}</span>
      </div>
      {info && (
        <div className="mx-2 mt-1 rounded-2xl bg-secondary/60 px-4 py-3 text-sm">
          <p>{c.summary || "Sem resumo por aqui."}</p>
          {c.source_quote && (
            <button onClick={() => setQuote(!quote)} className="mt-2 font-bold text-primary">{quote ? "esconder" : "📖 ver no material"}</button>
          )}
          {quote && <blockquote className="mt-2 border-l-4 border-gold pl-3 italic text-muted-foreground">“{c.source_quote}”</blockquote>}
        </div>
      )}
      {open && kids.length > 0 && <ul className="mt-2 space-y-2">{kids.map((k) => <Node key={k.id} c={k} all={all} cards={cards} depth={depth + 1} />)}</ul>}
    </li>
  );
}

function IslandPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const islands = useQuery({ queryKey: ["islands"], queryFn: fetchIslands });
  const cards = useQuery({ queryKey: ["cards", id], queryFn: () => fetchCards(id) });
  const concepts = useQuery({
    queryKey: ["concepts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("concepts").select("id, parent_id, title, summary, source_quote, depth").eq("island_id", id).order("importance", { ascending: false });
      if (error) throw error;
      return data as Concept[];
    },
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [oops, setOops] = useState<string | null>(null);

  if (islands.isLoading || cards.isLoading || concepts.isLoading) return <KipMessage>Navegando até a ilha... ⛵</KipMessage>;
  const isl = islands.data?.find((i) => i.id === id);
  if (islands.isError || cards.isError || concepts.isError) return <KipMessage action={<button onClick={() => { islands.refetch(); cards.refetch(); concepts.refetch(); }} className="w-full rounded-3xl bg-primary py-4 font-bold text-primary-foreground">Tentar de novo</button>}>A maré não deixou eu chegar na ilha agora. Tenta de novo? 🌊</KipMessage>;
  if (!isl) return <KipMessage action={<Link to="/" className="block w-full rounded-3xl bg-primary py-4 font-bold text-primary-foreground">Voltar ao mapa</Link>}>Essa ilha sumiu no horizonte 🌊</KipMessage>;

  const due = (cards.data ?? []).filter((c) => isDue(c)).length;
  async function rename() {
    if (!name.trim()) return;
    const { error } = await supabase.from("islands").update({ name: name.trim() }).eq("id", id);
    if (error) setOops("Não consegui trocar o nome agora. Tenta de novo? 💕");
    else { setEditing(false); qc.invalidateQueries({ queryKey: ["islands"] }); }
  }
  async function remove() {
    const { data: files } = await supabase.from("sources").select("file_path").eq("island_id", id);
    const paths = (files ?? []).map((f) => f.file_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("materials").remove(paths);
    const { error } = await supabase.from("islands").delete().eq("id", id);
    if (error) { setOops("Não consegui apagar a ilha agora. Tenta de novo daqui a pouco? 🌱"); return; }
    await qc.invalidateQueries({ queryKey: ["islands"] });
    nav({ to: "/" });
  }

  const roots = (concepts.data ?? []).filter((c) => !c.parent_id);
  return (
    <div className="px-4 pt-5">
      <Link to="/" className="text-sm font-bold text-muted-foreground">← Voltar ao mapa</Link>
      <div className="mt-4 flex flex-col items-center text-center">
        <div className="relative grid h-36 w-36 place-items-center rounded-[45%_55%_50%_50%/55%_45%_55%_45%] text-6xl" style={{ background: isl.color }}>
          {isl.emoji}<Fog level={isl.fog} />
        </div>
        {editing ? (
          <div className="mt-3 flex w-full gap-2">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-ring" />
            <button onClick={rename} className="rounded-2xl bg-gold px-4 font-bold text-navy">Salvar</button>
            <button onClick={() => setEditing(false)} className="rounded-2xl bg-secondary px-3">✕</button>
          </div>
        ) : <h1 className="mt-3 text-3xl font-bold">{isl.name}</h1>}
        <p className="mt-1 rounded-full bg-card px-3 py-1 text-sm font-bold">{fogLabel[isl.fog]}</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Kip size={44} className="animate-bob" />
          {isl.fog ? "Calma, a gente tira essa névoa juntinhos 💕" : due ? `Tem ${due} carta${due > 1 ? "s" : ""} te esperando ✨` : "Tudo limpinho por aqui! 🌙"}
        </div>
        {due > 0 ? (
          <Link to="/revisar" search={{ ilha: isl.id, modo: "ilha" }} className="mt-5 w-full rounded-3xl bg-gold py-5 font-display text-xl font-bold text-navy shadow-xl active:scale-95">
            {isl.fog ? "🛟 Resgatar a ilha" : "📚 Estudar hoje"}
          </Link>
        ) : (
          <div className="mt-5 w-full rounded-3xl bg-card py-5 font-display text-lg font-semibold">Nada pra revisar hoje. Pode descansar 🌙</div>
        )}
      </div>
      <h2 className="mt-8 mb-3 text-xl font-semibold">Conceitos</h2>
      {roots.length ? <ul className="space-y-2">{roots.map((c) => <Node key={c.id} c={c} all={concepts.data!} cards={cards.data ?? []} />)}</ul>
        : <p className="text-muted-foreground">Ainda não tem conceitos aqui.</p>}

      {oops && <p className="mt-6 rounded-2xl bg-card px-4 py-3 text-center text-sm font-bold">{oops}</p>}
      <div className="mt-8 flex gap-2">
        <button onClick={() => { setName(isl.name); setEditing(true); }} className="flex-1 rounded-2xl bg-secondary py-3 font-bold">✏️ Renomear</button>
        <button onClick={() => setConfirmDel(true)} className="flex-1 rounded-2xl bg-secondary py-3 font-bold">🗑️ Excluir</button>
      </div>
      {confirmDel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-6 backdrop-blur" onClick={() => setConfirmDel(false)}>
          <div className="w-full max-w-sm rounded-[2rem] bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <Kip size={70} className="mx-auto" />
            <p className="mt-3 font-display text-xl font-semibold">Apagar a ilha {isl.name}?</p>
            <p className="mt-1 text-sm text-muted-foreground">Os conceitos e cartas dela vão embora junto. Não dá pra desfazer.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-2xl bg-secondary py-3 font-bold">Manter</button>
              <button onClick={remove} className="flex-1 rounded-2xl bg-destructive py-3 font-bold text-destructive-foreground">Apagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
