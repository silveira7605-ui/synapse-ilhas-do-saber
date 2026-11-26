import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Kip } from "@/components/Kip";
import { KipMessage } from "@/components/KipMessage";
import { fetchCards, fetchIslands, isDue, type CardRow } from "@/lib/data";
import { schedule, crossMix, type Rating } from "@/lib/srs";

export const Route = createFileRoute("/_authenticated/revisar")({
  validateSearch: (s: Record<string, unknown>): { ilha?: string; modo?: string } => ({
    ...(typeof s["ilha"] === "string" ? { ilha: s["ilha"] } : {}),
    ...(typeof s["modo"] === "string" ? { modo: s["modo"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Revisar — Synapse" },
      { name: "description", content: "Revise suas cartas com o Kip." },
      { property: "og:title", content: "Revisar — Synapse" },
      { property: "og:description", content: "Revise suas cartas com o Kip." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { ilha, modo } = Route.useSearch();
  const isCross = modo === "cruzado";

  if (ilha || isCross) {
    return <ReviewSession islandId={ilha ?? undefined} isCross={isCross} />;
  }

  return <ReviewHome />;
}

function ReviewHome() {
  const { data: islands, isLoading } = useQuery({ queryKey: ["islands"], queryFn: fetchIslands });
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: () => fetchCards() });

  if (isLoading) return <KipMessage>Remando até a revisão... 🚣</KipMessage>;

  const dueCards = (cards ?? []).filter((c) => isDue(c));
  const dueIslands = (islands ?? []).filter((i) => i.due > 0);
  const canCross = (islands ?? []).length >= 1 && dueCards.length > 0;

  if (dueCards.length === 0) {
    return (
      <div className="px-4 pt-5">
        <div className="flex items-center gap-3">
          <Kip size={60} className="animate-bob shrink-0" />
          <h1 className="font-display text-2xl font-bold">Revisar hoje</h1>
        </div>
        <div className="mt-16 flex flex-col items-center text-center">
          <Kip size={110} className="animate-jump" />
          <p className="mt-6 max-w-xs font-display text-2xl font-semibold">
            Tudo em dia! Pode descansar 🌙
          </p>
          <p className="mt-2 text-muted-foreground">
            Você não tem cartas vencidas. Que tal voltar quando quiser revisar?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5">
      <div className="flex items-center gap-3">
        <Kip size={60} className="animate-bob shrink-0" />
        <h1 className="font-display text-2xl font-bold">Revisar hoje</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {dueCards.length} carta{dueCards.length > 1 ? "s" : ""} te esperando ✨
      </p>

      {canCross && (
        <Link
          to="/revisar"
          search={{ modo: "cruzado" }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-primary py-4 font-display text-lg font-bold text-primary-foreground shadow-lg active:scale-95"
        >
          ⚡ Desafio Cruzado
        </Link>
      )}

      <h2 className="mt-6 mb-3 text-lg font-semibold">Ilhas com revisões</h2>
      <div className="space-y-2">
        {dueIslands.map((i) => (
          <Link
            key={i.id}
            to="/revisar"
            search={{ ilha: i.id, modo: "ilha" }}
            className="flex items-center gap-3 rounded-3xl bg-card px-4 py-4 active:scale-95"
          >
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
              style={{ background: i.color }}
            >
              {i.emoji}
            </div>
            <div className="flex-1">
              <p className="font-bold">{i.name}</p>
              <p className="text-sm text-muted-foreground">
                {i.due} carta{i.due > 1 ? "s" : ""} para resgatar
              </p>
            </div>
            <span className="text-2xl">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReviewSession({ islandId, isCross }: { islandId?: string | undefined; isCross?: boolean | undefined }) {
  const qc = useQueryClient();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reporting, setReporting] = useState(false);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const all = await fetchCards(islandId);
      let pool = all.filter((c) => isDue(c));
      if (isCross) {
        const mixed = crossMix(
          pool.map((c) => ({ ...c, due: true })),
          12,
        );
        pool = mixed as unknown as CardRow[];
      } else {
        pool = pool.slice(0, 20);
      }
      if (pool.length === 0) {
        setDone(true);
      } else {
        setCards(pool);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [islandId, isCross]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function rate(rating: Rating) {
    const card = cards[idx];
    if (!card) return;
    const prev = card.state ?? { interval_days: 0, reps: 0, lapses: 0, last_review_at: null };
    const next = schedule(prev, rating);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("card_states")
      .upsert({
        card_id: card.id,
        user_id: user!.id,
        due_at: next.due_at,
        interval_days: next.interval_days,
        reps: next.reps,
        lapses: next.lapses,
        last_review_at: next.last_review_at,
      });

    await supabase.from("review_logs").insert({
      card_id: card.id,
      user_id: user!.id,
      rating,
    });

    if (idx + 1 >= cards.length) {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["islands"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    } else {
      setIdx(idx + 1);
      setFlipped(false);
    }
  }

  async function reportCard() {
    const card = cards[idx];
    if (!card) return;
    await supabase.from("cards").update({ reported: true }).eq("id", card.id);
    setReporting(false);
    if (idx + 1 >= cards.length) {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["islands"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    } else {
      setIdx(idx + 1);
      setFlipped(false);
    }
  }

  if (loading)
    return <KipMessage>Separando suas cartas... 🃏</KipMessage>;

  if (failed)
    return (
      <KipMessage
        action={
          <button onClick={loadCards} className="w-full rounded-3xl bg-primary py-4 font-bold text-primary-foreground">
            Tentar de novo
          </button>
        }
      >
        Não consegui pegar suas cartas agora 🌊 Tenta de novo?
      </KipMessage>
    );

  if (done)
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <Kip size={130} className="animate-jump" />
        <p className="mt-6 max-w-xs font-display text-3xl font-bold">Ilha resgatada! 🎉</p>
        <p className="mt-2 text-muted-foreground">
          A névoa foi embora e sua memória tá mais forte. Que orgulho! 💖
        </p>
        <div className="mt-8 w-full max-w-xs space-y-2">
          <Link
            to="/"
            className="block w-full rounded-3xl bg-gold py-4 font-display text-lg font-bold text-navy"
          >
            Ver no mapa
          </Link>
          <Link
            to="/revisar"
            className="block w-full rounded-3xl bg-card py-4 font-bold"
          >
            Revisar outra ilha
          </Link>
        </div>
      </div>
    );

  const card = cards[idx]!;
  const pct = ((idx) / cards.length) * 100;

  return (
    <div className="flex min-h-screen flex-col px-4 pt-5">
      <div className="flex items-center gap-2">
        <Link to="/revisar" className="text-sm font-bold text-muted-foreground">← Sair</Link>
        <div className="ml-auto text-sm font-bold text-muted-foreground">
          {idx + 1} de {cards.length}
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gold transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <div
          className={`flip relative w-full max-w-sm cursor-pointer ${flipped ? "on" : ""}`}
          style={{ minHeight: 320 }}
          onClick={() => !flipped && setFlipped(true)}
        >
          {/* Front */}
          <div className="face absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] bg-card p-8 text-center shadow-xl">
            <span className="mb-4 rounded-full bg-secondary px-3 py-1 text-xs font-bold">
              {card.type === "cloze" ? "Complete a frase" : "Pergunta"}
            </span>
            <p className="font-display text-2xl font-semibold">
              {renderCloze(card.front, flipped)}
            </p>
            {!flipped && (
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                className="mt-8 rounded-3xl bg-primary px-8 py-4 font-display text-lg font-bold text-primary-foreground active:scale-95"
              >
                Mostrar resposta
              </button>
            )}
          </div>

          {/* Back */}
          <div className="face back absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] bg-secondary p-8 text-center shadow-xl">
            <span className="mb-4 rounded-full bg-gold px-3 py-1 text-xs font-bold text-navy">Resposta</span>
            <p className="font-display text-3xl font-bold">{card.back}</p>
            {card.source_quote && (
              <p className="mt-4 max-w-xs text-sm italic text-muted-foreground">"{card.source_quote}"</p>
            )}
          </div>
        </div>
      </div>

      {flipped && (
        <div className="space-y-2 pb-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => rate(1)}
              className="rounded-3xl bg-destructive py-5 font-display text-lg font-bold text-destructive-foreground active:scale-95"
            >
              Errei 😵
            </button>
            <button
              onClick={() => rate(2)}
              className="rounded-3xl bg-secondary py-5 font-display text-lg font-bold text-secondary-foreground active:scale-95"
            >
              Quase 🤔
            </button>
            <button
              onClick={() => rate(3)}
              className="rounded-3xl bg-gold py-5 font-display text-lg font-bold text-navy active:scale-95"
            >
              Acertei 🎉
            </button>
          </div>
          <button
            onClick={() => setReporting(true)}
            className="w-full rounded-2xl py-3 text-sm font-bold text-muted-foreground"
          >
            🚩 Reportar carta errada
          </button>
        </div>
      )}

      {reporting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-6 backdrop-blur" onClick={() => setReporting(false)}>
          <div className="w-full max-w-sm rounded-[2rem] bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <Kip size={70} className="mx-auto" />
            <p className="mt-3 font-display text-xl font-semibold">Essa carta tem algo errado?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vou tirar ela da revisão e olhar com cal depois. Pode seguir pra próxima?
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setReporting(false)} className="flex-1 rounded-2xl bg-secondary py-3 font-bold">
                Não, ficar
              </button>
              <button onClick={reportCard} className="flex-1 rounded-2xl bg-destructive py-3 font-bold text-destructive-foreground">
                Sim, reportar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderCloze(front: string, flipped: boolean) {
  if (front.includes("{{")) {
    return front.replace(/\{\{(.+?)\}\}/g, flipped ? "$1" : "______");
  }
  return front;
}
