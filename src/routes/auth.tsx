import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Kip } from "@/components/Kip";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Synapse" }, { name: "description", content: "Entre no Synapse e explore seu arquipélago de estudos com o Kip." }, { property: "og:title", content: "Entrar — Synapse" }, { property: "og:description", content: "Entre no Synapse e explore seu arquipélago de estudos com o Kip." }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) nav({ to: "/" }); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: name } } });
      if (error) setMsg(error.message.includes("registered") ? "Esse email já tem conta! Tenta entrar 💕" : "Hmm, não deu certo. Confere o email e uma senha com 6+ letras? 🌱");
      else if (!data.session) setMsg("Quase lá! Te mandei um email pra confirmar a conta 💌");
      else nav({ to: "/" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("Email ou senha não bateram. Tenta de novo? 🫶");
      else nav({ to: "/" });
    }
    setBusy(false);
  }
  async function google() {
    setMsg(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { setMsg("O Google não respondeu agora. Tenta de novo daqui a pouquinho? 🌊"); return; }
    if (r.redirected) return;
    nav({ to: "/" });
  }

  const input = "w-full rounded-3xl border border-input bg-card px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="flex min-h-screen flex-col items-center px-5 pt-12">
      <Kip size={110} className="animate-bob" />
      <h1 className="mt-3 text-4xl font-bold">Synapse</h1>
      <p className="mt-1 text-center text-muted-foreground">Seu arquipélago de estudos, com o Kip do lado 💖</p>
      <form onSubmit={submit} className="mt-8 w-full max-w-sm space-y-3">
        {mode === "up" && <input className={input} placeholder="Como posso te chamar?" value={name} onChange={(e) => setName(e.target.value)} required />}
        <input className={input} type="email" placeholder="Seu email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Sua senha" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {msg && <p className="rounded-2xl bg-card px-4 py-3 text-center text-sm font-bold">{msg}</p>}
        <button disabled={busy} className="w-full rounded-3xl bg-gold py-4 text-xl font-bold text-navy active:scale-95 disabled:opacity-60">
          {mode === "in" ? "Entrar" : "Criar minha conta"}
        </button>
        <button type="button" onClick={google} className="google-btn flex w-full items-center justify-center gap-[10px] rounded-3xl border px-3 py-4 text-sm font-medium">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continuar com o Google
        </button>
        <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="w-full py-2 text-sm font-bold text-primary">
          {mode === "in" ? "Ainda não tem conta? Criar agora ✨" : "Já tenho conta, quero entrar"}
        </button>
      </form>
    </div>
  );
}
