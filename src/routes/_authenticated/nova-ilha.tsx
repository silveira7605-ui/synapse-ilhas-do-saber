import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Kip } from "@/components/Kip";
import { KipMessage } from "@/components/KipMessage";
import { born } from "@/lib/born";
import { islandPosition, ISLAND_COLORS_DEFAULT } from "@/lib/srs";
import { analyzeChunk, saveIslandContent, confirmAiAccessRestored, type ChunkResult } from "@/lib/island.functions";
import { mergeChunks } from "@/lib/merge";
import { fileProblem, pdfProblem, MAX_IMAGES, textChunks } from "@/lib/material";

export const Route = createFileRoute("/_authenticated/nova-ilha")({
  head: () => ({
    meta: [
      { title: "Nova Ilha — Synapse" },
      { name: "description", content: "Crie uma nova ilha de estudos com o Kip." },
      { property: "og:title", content: "Nova Ilha — Synapse" },
      { property: "og:description", content: "Crie uma nova ilha de estudos com o Kip." },
    ],
  }),
  component: NewIslandPage,
});

type PendingFile = { file: File; preview: string; kind: "pdf" | "image" };

const KIP_PHRASES = [
  "Lendo seu material... 📖",
  "Construindo a ilha... 🏝️",
  "Criando suas cartas... 🃏",
  "Quase pronto... ✨",
];

function NewIslandPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeChunk);
  const save = useServerFn(saveIslandContent);
  const restoreAccess = useServerFn(confirmAiAccessRestored);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [validating, setValidating] = useState(false);
  const validationLock = useRef(false);
  const creationLock = useRef(false);
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => { for (const f of filesRef.current) if (f.preview) URL.revokeObjectURL(f.preview); }, []);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null, kind: "pdf" | "image") {
    if (!list || validationLock.current) return;
    validationLock.current = true;
    setValidating(true);
    const incoming = Array.from(list);
    const valid: PendingFile[] = [];
    setError(null);
    try {
    for (const f of incoming) {
      const problem = fileProblem(f, kind) ?? (kind === "pdf" ? await pdfProblem(await f.arrayBuffer()) : null);
      if (problem) { setError(problem); continue; }
      if (kind === "image" && filesRef.current.filter((f) => f.kind === "image").length + valid.length >= MAX_IMAGES) {
        setError(`Você pode enviar até ${MAX_IMAGES} fotos. 💕`); continue;
      }
      const preview = kind === "pdf" ? "" : URL.createObjectURL(f);
      valid.push({ file: f, preview, kind });
    }
    setFiles((prev) => [...prev, ...valid]);
    } finally { validationLock.current = false; setValidating(false); }
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const f = prev[idx];
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function createIsland() {
    if (creationLock.current || validating || denied) return;
    if (!text.trim() && files.length === 0) {
      setError("Cola um texto, manda um PDF ou uma foto pra eu começar! 🌱");
      return;
    }
    setBusy(true);
    creationLock.current = true;
    setError(null);
    setPhase(0);

    let createdId: string | null = null;
    const uploadedPaths: string[] = [];
    let completed = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Entre na sua conta para criar uma ilha 💕");
      // 1. Create island row
      const { data: island, error: ie } = await supabase
        .from("islands")
        .insert({ name: name.trim() || "Nova ilha" })
        .select()
        .single();
      if (ie || !island) throw new Error("island");
      createdId = island.id;

      // 2. Upload files to private storage and create source rows
      const userId = user.id;
      const fileSources: { path: string; mime: string; name: string }[] = [];
      const sourceRows: { island_id: string; kind: string; file_path: string | null; raw_text: string | null; status: string }[] = [];

      for (const f of files) {
        const ext = f.kind === "pdf" ? ".pdf" : f.file.name.match(/\.\w+$/)?.[0] ?? ".jpg";
        const path = `${userId}/${island.id}/${crypto.randomUUID()}${ext}`;
        const { error: ue } = await supabase.storage.from("materials").upload(path, f.file);
        if (ue) throw new Error("upload");
        uploadedPaths.push(path);
        fileSources.push({ path, mime: f.file.type, name: f.file.name });
        sourceRows.push({ island_id: island.id, kind: f.kind, file_path: path, raw_text: null, status: "processing" });
      }
      if (text.trim()) {
        sourceRows.push({ island_id: island.id, kind: "text", file_path: null, raw_text: text.trim(), status: "processing" });
      }
      if (sourceRows.length) {
        const { error: se } = await supabase.from("sources").insert(sourceRows);
        if (se) throw new Error("source");
      }

      // 3. Run AI analysis in chunks
      const chunks: ChunkResult[] = [];
      const texts = textChunks(text);
      const batches = Math.max(texts.length, Math.ceil(fileSources.length / 3));
      for (let i = 0; i < batches; i++) {
        const r = await analyze({ data: { text: texts[i] ?? "", files: fileSources.slice(i * 3, i * 3 + 3) } });
        if (!r.ok) { setDenied(r.reason === "denied"); throw new Error(r.message); }
        chunks.push(r.result);
      }
      setPhase(1);

      // 4. Merge results
      const merged = mergeChunks(chunks);
      const bestName = name.trim() || chunks[0]?.island_name || "Nova ilha";
      const bestEmoji = chunks[0]?.emoji || "🏝️";

      // 5. Save concepts + cards + initial card states
      setPhase(2);
      await save({
        data: {
          islandId: island.id,
          name: bestName,
          emoji: bestEmoji,
          concepts: merged.concepts,
          cards: merged.cards,
        },
      });

      // 6. Update map position
      const { data: positions, error: pe } = await supabase.from("islands").select("map_y").neq("id", island.id).order("map_y", { ascending: false }).limit(1);
      if (pe) throw new Error("save");
      const count = positions?.[0] ? Math.floor((positions[0].map_y - 90) / 150) + 1 : 0;
      const pos = islandPosition(count);
      const colorIdx = (count ?? 0) % 5;
      const colorVal = ISLAND_COLORS_DEFAULT[colorIdx] ?? "var(--isle-violet)";
      const { data: updated, error: updateError } = await supabase
        .from("islands")
        .update({ map_x: pos.map_x, map_y: pos.map_y, color: colorVal })
        .eq("id", island.id)
        .select("id")
        .single();
      if (updateError) throw new Error("save");

      completed = true;
      setPhase(3);
      await qc.invalidateQueries({ queryKey: ["islands"] });
      await qc.invalidateQueries({ queryKey: ["cards"] });
      born.id = updated?.id ?? island.id;
      nav({ to: "/" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "";
      const internal = ["island", "upload", "source", "save", "ai"];
      setError(message && !internal.includes(message) && !message.includes("Server") ? message : "Não consegui construir a ilha agora 🌱 Seu material continua aqui. Tenta de novo?");
      if (createdId && !completed) {
        await supabase.from("sources").update({ status: "failed" }).eq("island_id", createdId);
        if (uploadedPaths.length) await supabase.storage.from("materials").remove(uploadedPaths);
        await supabase.from("islands").delete().eq("id", createdId);
        await qc.invalidateQueries({ queryKey: ["islands"] });
      }
    } finally {
      creationLock.current = false;
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <Kip size={120} className="animate-bob" />
        <p className="mt-6 max-w-xs font-display text-2xl font-semibold">{KIP_PHRASES[phase]}</p>
        <div className="mt-6 h-2 w-48 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gold transition-all duration-1000"
            style={{ width: `${((phase + 1) / KIP_PHRASES.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5">
      <button onClick={() => nav({ to: "/" })} className="text-sm font-bold text-muted-foreground">
        ← Voltar ao mapa
      </button>
      <div className="mt-4 flex items-center gap-3">
        <Kip size={60} className="animate-bob shrink-0" />
        <h1 className="font-display text-2xl font-bold">Nova ilha</h1>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-bold text-muted-foreground">
            Nome da matéria (opcional — a IA pode sugerir um)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Biologia, História..."
            className="w-full rounded-3xl border border-input bg-card px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold text-muted-foreground">
            Cola o texto do seu material
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o conteúdo que você quer estudar..."
            rows={5}
            className="w-full resize-y rounded-3xl border border-input bg-card px-5 py-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-muted-foreground">
            Ou envia arquivos (PDF ou fotos)
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => pdfInput.current?.click()}
              className="flex-1 rounded-3xl bg-card px-4 py-4 font-bold text-center active:scale-95"
            >
              📄 PDF
            </button>
            <button
              onClick={() => photoInput.current?.click()}
              className="flex-1 rounded-3xl bg-card px-4 py-4 font-bold text-center active:scale-95"
            >
              🖼️ Galeria
            </button>
            <button
              onClick={() => cameraInput.current?.click()}
              className="flex-1 rounded-3xl bg-card px-4 py-4 font-bold text-center active:scale-95"
            >
              📷 Câmera
            </button>
          </div>
          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { addFiles(e.target.files, "pdf"); e.target.value = ""; }}
          />
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files, "image"); e.target.value = ""; }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files, "image"); e.target.value = ""; }}
          />
        </div>

        {files.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold text-muted-foreground">
              Arquivos ({files.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative rounded-2xl bg-card p-2">
                  {f.kind === "pdf" ? (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-secondary text-2xl">📄</div>
                  ) : (
                    <img src={f.preview} alt={f.file.name} className="h-16 w-16 rounded-xl object-cover" />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground"
                  >
                    ✕
                  </button>
                  <p className="mt-1 max-w-16 truncate text-xs text-muted-foreground">{f.file.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-2xl bg-card px-4 py-3 text-center text-sm font-bold">
            {error}
            {denied ? <Button variant="secondary" className="mt-3 h-auto w-full rounded-3xl py-3" onClick={async () => { try { await restoreAccess(); setDenied(false); setError(null); } catch { setError("Não consegui conferir meu acesso agora 🌊"); } }}>O responsável já restabeleceu o acesso</Button>
            : <Button className="mt-3 h-auto w-full rounded-3xl py-3" disabled={validating} onClick={createIsland}>Tentar de novo</Button>}
          </div>
        )}

        <button
          onClick={createIsland}
          disabled={busy || validating || denied || (!text.trim() && files.length === 0)}
          className="w-full rounded-3xl bg-gold py-5 font-display text-xl font-bold text-navy shadow-xl active:scale-95 disabled:opacity-50"
        >
          {validating ? "Conferindo seu arquivo... 📄" : "🏝️ Criar minha ilha"}
        </button>
      </div>
    </div>
  );
}
