import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Kip, Fog } from "@/components/Kip";
import { KipMessage } from "@/components/KipMessage";
import { Button } from "@/components/ui/button";
import { fetchCards, fetchIslands, isDue, type CardRow } from "@/lib/data";
import { sessionCards, type Rating } from "@/lib/srs";

export const Route = createFileRoute("/_authenticated/revisar")({
  validateSearch: (s: Record<string, unknown>): { ilha?: string; modo?: string } => ({
    ...(typeof s["ilha"] === "string" ? { ilha: s["ilha"] } : {}),
    ...(typeof s["modo"] === "string" ? { modo: s["modo"] } : {}),
  }),
  head: () => ({ meta: [
    { title: "Revisar — Synapse" },
    { name: "description", content: "Revise suas cartas e resgate suas ilhas com o Kip." },
    { property: "og:title", content: "Revisar — Synapse" },
    { property: "og:description", content: "Revise suas cartas e resgate suas ilhas com o Kip." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { ilha, modo } = Route.useSearch();
  return ilha || modo === "cruzado" || modo === "hoje"
    ? <ReviewSession key={`${ilha ?? "all"}:${modo}`} islandId={ilha} isCross={modo === "cruzado"} />
    : <ReviewHome />;
}

function ReviewHome() {
  const islands = useQuery({ queryKey: ["islands"], queryFn: fetchIslands, refetchOnMount: "always" });
  const cards = useQuery({ queryKey: ["cards"], queryFn: () => fetchCards(), refetchOnMount: "always" });
  if (islands.isLoading || cards.isLoading) return <KipMessage>Remando até a revisão... 🚣</KipMessage>;
  if (islands.isError || cards.isError) return <KipMessage action={<Button onClick={() => { islands.refetch(); cards.refetch(); }} className="h-auto w-full rounded-3xl py-4">Tentar de novo</Button>}>Não consegui separar suas cartas. Vamos tentar de novo? 🌊</KipMessage>;
  const due = (cards.data ?? []).filter((c) => isDue(c));
  return <div className="px-4 pt-5">
    <div className="flex items-center gap-3"><Kip size={60} className="animate-bob shrink-0" /><h1 className="font-display text-2xl font-bold">Revisar hoje</h1></div>
    {due.length > 0 ? <>
      <p className="mt-2 text-sm text-muted-foreground">{due.length} carta{due.length === 1 ? "" : "s"} te esperando ✨</p>
      <Button asChild className="mt-5 h-auto w-full rounded-3xl bg-gold py-5 font-display text-xl font-bold text-navy"><Link to="/revisar" search={{ modo: "hoje" }}>🃏 Começar revisão</Link></Button>
    </> : <div className="mt-12 flex flex-col items-center text-center"><Kip size={110} className="animate-jump" /><p className="mt-6 font-display text-2xl font-semibold">Tudo em dia! Pode descansar 🌙</p></div>}
    {(cards.data?.length ?? 0) > 0 && <Button asChild className="mt-4 h-auto w-full rounded-3xl py-4 font-display text-lg font-bold"><Link to="/revisar" search={{ modo: "cruzado" }}>⚡ Desafio Cruzado</Link></Button>}
    {due.length > 0 && <><h2 className="mb-3 mt-6 text-lg font-semibold">Ilhas com revisões</h2><div className="space-y-2">{(islands.data ?? []).filter((i) => i.due > 0).map((i) => <Button key={i.id} variant="ghost" asChild className="h-auto w-full justify-start whitespace-normal rounded-3xl bg-card px-4 py-4"><Link to="/revisar" search={{ ilha: i.id, modo: "ilha" }}><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: i.color }}>{i.emoji}</div><div className="min-w-0 flex-1 text-left"><p className="font-bold break-words">{i.name}</p><p className="text-sm text-muted-foreground">{i.due} carta{i.due === 1 ? "" : "s"} para resgatar</p></div><span className="text-2xl">→</span></Link></Button>)}</div></>}
  </div>;
}

function ReviewSession({ islandId, isCross }: { islandId: string | undefined; isCross: boolean }) {
  const qc = useQueryClient();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescued, setRescued] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const lock = useRef(false);
  const reviewIds = useRef(new Map<string, string>());

  const loadCards = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const all = await fetchCards(islandId);
      all.sort((a, b) => (a.state ? new Date(a.state.due_at).getTime() : 0) - (b.state ? new Date(b.state.due_at).getTime() : 0));
      const pool = sessionCards(all.map((c) => ({ ...c, due: isDue(c) })), isCross);
      setCards(pool); setIdx(0); setFlipped(false); setDone(pool.length === 0);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, [islandId, isCross]);
  useEffect(() => { void loadCards(); }, [loadCards]);

  async function advance() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["islands"] }), qc.invalidateQueries({ queryKey: ["cards"] }), qc.invalidateQueries({ queryKey: ["profile"] })]);
    if (idx + 1 < cards.length) { setIdx((n) => n + 1); setFlipped(false); return; }
    if (islandId) {
      try { const islands = await fetchIslands(); setRescued(islands.find((i) => i.id === islandId)?.fog === 0); } catch { setRescued(false); }
    }
    setDone(true);
  }

  async function rate(rating: Rating) {
    const card = cards[idx];
    if (!card || lock.current) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      const reviewId = reviewIds.current.get(card.id) ?? crypto.randomUUID();
      reviewIds.current.set(card.id, reviewId);
      const { error } = await supabase.rpc("record_review", { _card: card.id, _rating: rating, _review_id: reviewId });
      if (error) throw error;
      setReviewed((n) => n + 1);
      await advance();
    } catch { setError("Não consegui guardar sua resposta. Sua carta continua aqui — tenta de novo? 💕"); }
    finally { lock.current = false; setSaving(false); }
  }

  async function reportCard() {
    const card = cards[idx];
    if (!card || lock.current) return;
    lock.current = true; setSaving(true); setError(null);
    try {
      const { error } = await supabase.from("cards").update({ reported: true }).eq("id", card.id);
      if (error) throw error;
      setReporting(false); await advance();
    } catch { setError("Não consegui guardar o aviso. Tenta de novo? 💕"); }
    finally { lock.current = false; setSaving(false); }
  }

  if (loading) return <KipMessage>Separando suas cartas... 🃏</KipMessage>;
  if (failed) return <KipMessage action={<Button onClick={loadCards} className="h-auto w-full rounded-3xl py-4">Tentar de novo</Button>}>Não consegui pegar suas cartas agora 🌊</KipMessage>;
  if (done) return <div className="flex min-h-[65vh] flex-col items-center justify-center px-6 text-center">
    <div className="relative"><Kip size={130} className="animate-jump" />{rescued && <div className="animate-fogaway absolute inset-0"><Fog level={2} /></div>}</div>
    <p className="mt-6 max-w-xs font-display text-3xl font-bold">{cards.length === 0 ? "Tudo em dia! Pode descansar 🌙" : rescued ? "Ilha resgatada! 🎉" : isCross ? "Desafio concluído! ⚡" : "Revisão concluída! 🎉"}</p>
    {cards.length > 0 && <p className="mt-2 text-muted-foreground">{reviewed} carta{reviewed === 1 ? "" : "s"} revisada{reviewed === 1 ? "" : "s"}. Sua memória tá mais forte. Que orgulho! 💖</p>}
    <div className="mt-8 w-full max-w-xs space-y-2"><Button asChild className="h-auto w-full rounded-3xl bg-gold py-4 text-lg font-bold text-navy"><Link to="/">Ver no mapa</Link></Button><Button asChild variant="secondary" className="h-auto w-full rounded-3xl py-4 font-bold"><Link to="/revisar" search={{}}>Voltar à revisão</Link></Button></div>
  </div>;
  const card = cards[idx];
  if (!card) return <KipMessage>Suas cartas estão em dia 🌙</KipMessage>;
  return <div className="flex min-h-[calc(100dvh-7rem)] flex-col px-4 pt-5">
    <div className="flex items-center gap-2"><Button asChild variant="link" className="px-0 text-muted-foreground"><Link to="/revisar" search={{}}>← Sair</Link></Button><span className="ml-auto text-sm font-bold text-muted-foreground">{idx + 1} de {cards.length}</span></div>
    <div role="progressbar" aria-valuenow={idx} aria-valuemin={0} aria-valuemax={cards.length} aria-label="Cartas revisadas" className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gold transition-all duration-300" style={{ width: `${idx / cards.length * 100}%` }} /></div>
    <div className="flex flex-1 items-center justify-center py-6">
      <div className={`flip relative min-h-80 w-full max-w-sm ${flipped ? "on" : ""}`}>
        <div aria-hidden={flipped} inert={flipped} className="face absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[2rem] bg-card p-6 text-center shadow-xl">
          <span className="mb-4 rounded-full bg-secondary px-3 py-1 text-xs font-bold">{card.type === "cloze" ? "Complete a frase" : "Pergunta"}</span>
          <p className="font-display text-2xl font-semibold break-words">{card.front.replace(/\{\{(.+?)\}\}/g, "______")}</p>
          <Button onClick={() => setFlipped(true)} className="mt-6 h-auto rounded-3xl px-8 py-4 font-display text-lg font-bold">Mostrar resposta</Button>
        </div>
        <div aria-hidden={!flipped} inert={!flipped} className="face back absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[2rem] bg-secondary p-6 text-center shadow-xl">
          <span className="mb-4 rounded-full bg-gold px-3 py-1 text-xs font-bold text-navy">Resposta</span><p className="font-display text-2xl font-bold break-words">{card.back}</p>
          {card.source_quote && <p className="mt-4 text-sm italic text-muted-foreground break-words">“{card.source_quote}”</p>}
        </div>
      </div>
    </div>
    {error && <p role="alert" className="mb-3 rounded-2xl bg-card p-3 text-center text-sm font-bold">{error}</p>}
    {flipped && <div className="space-y-2 pb-4"><div className="grid grid-cols-3 gap-2">
      <Button disabled={saving} onClick={() => rate(1)} variant="destructive" className="h-auto rounded-3xl px-1 py-5 font-display text-base font-bold">Errei 😵</Button>
      <Button disabled={saving} onClick={() => rate(2)} variant="secondary" className="h-auto rounded-3xl px-1 py-5 font-display text-base font-bold">Quase 🤔</Button>
      <Button disabled={saving} onClick={() => rate(3)} className="h-auto rounded-3xl bg-gold px-1 py-5 font-display text-base font-bold text-navy">Acertei 🎉</Button>
    </div><Button disabled={saving} variant="ghost" onClick={() => setReporting(true)} className="h-auto w-full rounded-2xl py-3 text-sm font-bold text-muted-foreground">🚩 Reportar carta</Button></div>}
    {reporting && <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-6 backdrop-blur"><div role="dialog" aria-modal="true" aria-labelledby="report-title" className="w-full max-w-sm rounded-[2rem] bg-card p-6 text-center"><Kip size={70} className="mx-auto" /><h2 id="report-title" className="mt-3 font-display text-xl font-semibold">Essa carta tem algo errado?</h2><p className="mt-1 text-sm text-muted-foreground">Vou tirar ela da revisão. Pode seguir pra próxima? 💕</p>{error && <p role="alert" className="mt-3 text-sm">{error}</p>}<div className="mt-5 flex gap-2"><Button disabled={saving} onClick={() => setReporting(false)} variant="secondary" className="h-auto flex-1 rounded-2xl py-3">Não, ficar</Button><Button disabled={saving} onClick={reportCard} variant="destructive" className="h-auto flex-1 rounded-2xl py-3">Sim, reportar</Button></div></div></div>}
  </div>;
}
