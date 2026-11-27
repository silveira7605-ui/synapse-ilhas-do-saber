import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Kip } from "@/components/Kip";
import { KipMessage } from "@/components/KipMessage";
import { streak } from "@/lib/srs";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — Synapse" },
      { name: "description", content: "Seu perfil e progresso no Synapse." },
      { property: "og:title", content: "Perfil — Synapse" },
      { property: "og:description", content: "Seu perfil e progresso no Synapse." },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const nav = useNavigate();
  const [exitError, setExitError] = useState(false);
  const [exiting, setExiting] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no-user");

      const fullName = (user.user_metadata as any)?.full_name as string | undefined;
      const email = user.email ?? "";

      // Get review logs for streak + total
      const dates: string[] = [];
      let totalReviewed = 0;
      for (let offset = 0; ; offset += 1000) {
        const { data: logs, error, count } = await supabase.from("review_logs").select("reviewed_at", { count: "exact" }).order("reviewed_at", { ascending: false }).range(offset, offset + 999);
        if (error) throw error;
        totalReviewed = count ?? 0;
        dates.push(...(logs ?? []).map((l) => l.reviewed_at));
        if ((logs?.length ?? 0) < 1000) break;
      }
      const dayStreak = streak(dates);

      // Count islands
      const { count: islandCount, error: islandsError } = await supabase
        .from("islands")
        .select("id", { count: "exact", head: true });

      // Count cards studied at least once
      const { count: cardsStudied, error: studiedError } = await supabase
        .from("card_states")
        .select("card_id", { count: "exact", head: true })
        .not("last_review_at", "is", null);
      if (islandsError || studiedError) throw islandsError ?? studiedError;

      return {
        name: fullName || email.split("@")[0] || "Explorador(a)",
        email,
        dayStreak,
        totalReviewed,
        islandCount: islandCount ?? 0,
        cardsStudied: cardsStudied ?? 0,
      };
    },
  });

  async function signOut() {
    setExiting(true); setExitError(false);
    const { error } = await supabase.auth.signOut();
    if (error) { setExitError(true); setExiting(false); return; }
    nav({ to: "/auth" });
  }

  if (isLoading) return <KipMessage>Carregando seu perfil... ⛵</KipMessage>;
  if (!profile) return <KipMessage>Não consegui carregar seu perfil agora 🌊</KipMessage>;

  return (
    <div className="px-4 pt-5">
      <div className="flex items-center gap-3">
        <Kip size={60} className="animate-bob shrink-0" />
        <h1 className="font-display text-2xl font-bold">Perfil</h1>
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-primary text-4xl font-bold text-primary-foreground">
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="mt-3 font-display text-2xl font-bold">{profile.name}</h2>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-card p-5 text-center">
          <p className="text-4xl">🔥</p>
          <p className="mt-2 font-display text-3xl font-bold">{profile.dayStreak}</p>
          <p className="text-sm text-muted-foreground">
            {profile.dayStreak === 1 ? "dia seguido" : "dias seguidos"}
          </p>
        </div>
        <div className="rounded-3xl bg-card p-5 text-center">
          <p className="text-4xl">🃏</p>
          <p className="mt-2 font-display text-3xl font-bold">{profile.totalReviewed}</p>
          <p className="text-sm text-muted-foreground">cartas revisadas</p>
        </div>
        <div className="rounded-3xl bg-card p-5 text-center">
          <p className="text-4xl">🏝️</p>
          <p className="mt-2 font-display text-3xl font-bold">{profile.islandCount}</p>
          <p className="text-sm text-muted-foreground">ilhas criadas</p>
        </div>
        <div className="rounded-3xl bg-card p-5 text-center">
          <p className="text-4xl">📚</p>
          <p className="mt-2 font-display text-3xl font-bold">{profile.cardsStudied}</p>
          <p className="text-sm text-muted-foreground">cartas estudadas</p>
        </div>
      </div>

      <div className="mt-8">
        {exitError && <p role="alert" className="mb-3 text-center text-sm">Não consegui sair agora. Tenta de novo? 💕</p>}
        <Button variant="secondary" disabled={exiting}
          onClick={signOut}
          className="h-auto w-full rounded-3xl py-4 font-bold active:scale-95"
        >
          Sair da conta
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Kip size={32} className="animate-bob" />
        <span>Feito com carinho pelo Kip 💖</span>
      </div>
    </div>
  );
}
