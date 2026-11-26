import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Kip } from "@/components/Kip";
import { KipMessage } from "@/components/KipMessage";
import { born } from "@/lib/born";
import { islandPosition, ISLAND_COLORS_DEFAULT } from "@/lib/srs";
import { analyzeChunk, saveIslandContent, type ChunkResult } from "@/lib/island.functions";
import { mergeChunks } from "@/lib/merge";

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

const MAX_SIZE = 15 * 1024 * 1024;
const MAX_IMAGES = 10;
const KIP_PHRASES = [
  "Lendo seu material... 📖",
  "Construindo a ilha... 🏝️",
  "Criando suas cartas... 🃏",
  "Quase pronto... ✨",
];

function NewIslandPage() {
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null, kind: "pdf" | "image") {
    if (!list) return;
    const incoming = Array.from(list);
    const valid: PendingFile[] = [];
    for (const f of incoming) {
      if (f.size > MAX_SIZE) {
        setError(`O arquivo "${f.name}" é muito grande. O limite é 15 MB por arquivo. 💕`);
        continue;
      }
      if (kind === "pdf" && f.type !== "application/pdf") {
        setError(`"${f.name}" não é um PDF. Só aceito PDFs nesse botão. 📄`);
        continue;
      }
      if (kind === "image" && !f.type.startsWith("image/")) {
        setError(`"${f.name}" não é uma imagem. 📷`);
        continue;
      }
      const preview = kind === "pdf" ? "" : URL.createObjectURL(f);
      valid.push({ file: f, preview, kind });
    }
    if (kind === "image") {
      const existing = files.filter((f) => f.kind === "image");
      if (existing.length + valid.length > MAX_IMAGES) {
        setError(`Você pode enviar até ${MAX_IMAGES} fotos. 💕`);
        valid.splice(MAX_IMAGES - existing.length);
      }
    }
    setFiles((prev) => [...prev, ...valid]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const f = prev[idx];
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function createIsland() {
    if (!text.trim() && files.length === 0) {
      setError("Cola um texto, manda um PDF ou uma foto pra eu começar! 🌱");
      return;
    }
    setBusy(true);
    setError(null);
    setPhase(0);

    try {
      // 1. Create island row
      const { data: island, error: ie } = await supabase
        .from("islands")
        .insert({ name: name.trim() || "Nova ilha" })
        .select()
        .single();
      if (ie || !island) throw new Error("island");

      // 2. Upload files to private storage and create source rows
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user!.id;
      const fileSources: { path: string; mime: string; name: string }[] = [];
      const sourceRows: { island_id: string; kind: string; file_path: string | null; raw_text: string | null; status: string }[] = [];

      for (const f of files) {
        const ext = f.kind === "pdf" ? ".pdf" : f.file.name.match(/\.\w+$/)?.[0] ?? ".jpg";
        const path = `${userId}/${island.id}/${crypto.randomUUID()}${ext}`;
        const { error: ue } = await supabase.storage.from("materials").upload(path, f.file);
        if (ue) throw new Error("upload");
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

      setPhase(0);
      const phraseTimer = setInterval(() => setPhase((p) => Math.min(p + 1, KIP_PHRASES.length - 1)), 4000);

      // 3. Run AI analysis in chunks
      const chunks: ChunkResult[] = [];
      const textChunk = text.trim().slice(0, 12000);

      // Chunk 1: text (if any) + first few images
      const firstFiles = fileSources.slice(0, 4);
      const remainingFiles = fileSources.slice(4);

      if (textChunk || firstFiles.length) {
        const r = await analyzeChunk({ data: { text: textChunk, files: firstFiles } });
        if (r.ok) chunks.push(r.result);
      }

      // Additional chunks for remaining files (3 images per chunk)
      for (let i = 0; i < remainingFiles.length; i += 3) {
        const batch = remainingFiles.slice(i, i + 3);
        const r = await analyzeChunk({ data: { text: "", files: batch } });
        if (r.ok) chunks.push(r.result);
      }

      clearInterval(phraseTimer);
      setPhase(KIP_PHRASES.length - 1);

      if (!chunks.length) throw new Error("ai");

      // 4. Merge results
      const merged = mergeChunks(chunks);
      const bestName = chunks[0]!.island_name || name.trim() || "Nova ilha";
      const bestEmoji = chunks[0]!.emoji || "🏝️";

      // 5. Save concepts + cards + initial card states
      await saveIslandContent({
        data: {
          islandId: island.id,
          name: bestName,
          emoji: bestEmoji,
          concepts: merged.concepts,
          cards: merged.cards,
        },
      });

      // 6. Update map position
      const { count } = await supabase.from("islands").select("id", { count: "exact", head: true });
      const pos = islandPosition(count ?? 0);
      const colorIdx = (count ?? 0) % 5;
      const colorVal = ISLAND_COLORS_DEFAULT[colorIdx] ?? "var(--isle-violet)";
      const { data: updated } = await supabase
        .from("islands")
        .update({ map_x: pos.map_x, map_y: pos.map_y, color: colorVal })
        .eq("id", island.id)
        .select("id")
        .single();

      born.id = updated?.id ?? island.id;
      nav({ to: "/" });
    } catch (e: any) {
      console.error("createIsland failed", e);
      const msg = e?.message === "credits"
        ? "As minhas estrelinhas de IA acabaram por hoje 🌟 Tenta de novo mais tarde, tá?"
        : e?.message === "busy"
        ? "A IA tá muito ocupada agora 🌊 Dá uns minutinhos e tenta de novo?"
        : "Não consegui construir a ilha agora 🌱 Tenta de novo?";
      setError(msg);
    } finally {
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
          <div className="rounded-2xl bg-card px-4 py-3 text-center text-sm font-bold">{error}</div>
        )}

        <button
          onClick={createIsland}
          disabled={busy || (!text.trim() && files.length === 0)}
          className="w-full rounded-3xl bg-gold py-5 font-display text-xl font-bold text-navy shadow-xl active:scale-95 disabled:opacity-50"
        >
          🏝️ Criar minha ilha
        </button>
      </div>
    </div>
  );
}
