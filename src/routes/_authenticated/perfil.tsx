import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
      const { data: logs } = await supabase
        .from("review_logs")
        .select("reviewed_at")
        .order("reviewed_at", { ascending: false });

      const dates = (logs ?? []).map((l) => l.reviewed_at);
      const dayStreak = streak(dates);
      const totalReviewed = logs?.length ?? 0;

      // Count islands
      const { count: islandCount } = await supabase
        .from("islands")
        .select("id", { count: "exact", head: true });

      // Count cards studied at least once
      const { count: cardsStudied } = await supabase
        .from("card_states")
        .select("card_id", { count: "exact", head: true })
        .not("last_review_at", "is", null);

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
    await supabase.auth.signOut();
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
        <button
          onClick={signOut}
          className="w-full rounded-3xl bg-secondary py-4 font-bold text-secondary-foreground active:scale-95"
        >
          Sair da conta
        </button>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Kip size={32} className="animate-bob" />
        <span>Feito com carinho pelo Kip 💖</span>
      </div>
    </div>
  );
}
