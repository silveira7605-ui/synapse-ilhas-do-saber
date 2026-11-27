import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fileProblem, pdfProblem } from "./material";
import type { UserContent } from "ai";

const conceptSchema = z.object({
  key: z.string(),
  parent_key: z.string().nullable(),
  depth: z.number(),
  title: z.string(),
  summary: z.string(),
  importance: z.number(),
  source_quote: z.string(),
});
const cardSchema = z.object({
  concept_key: z.string(),
  type: z.enum(["cloze", "qa"]),
  front: z.string(),
  back: z.string(),
  source_quote: z.string(),
});
const resultSchema = z.object({
  island_name: z.string(),
  emoji: z.string(),
  concepts: z.array(conceptSchema),
  cards: z.array(cardSchema),
});
export type ChunkResult = z.infer<typeof resultSchema>;

const INSTRUCTIONS = `Você transforma material de estudo em uma "ilha" de conceitos e cartas de revisão.
Regras obrigatórias:
- Use SOMENTE informações presentes no material. Nunca invente nada.
- Escreva no MESMO idioma do material.
- Leia PDFs e fotos diretamente, incluindo letra de mão, setas e diagramas. Se um trecho estiver ilegível, ignore-o em vez de adivinhar.
- island_name: nome curto da matéria; emoji: um único emoji que represente o tema.
- concepts: árvore em até 3 níveis. depth 0 = grandes regiões, 1 = tópicos, 2 = detalhes. Use "key" curtas e únicas (ex.: "c1", "c1.2"); parent_key é null em depth 0 e aponta para o pai nos demais.
- title curto; summary com no máximo 2 frases; importance inteiro de 1 a 5; source_quote = citação curta e literal do material.
- cards: de 1 a 3 por conceito (3 para importância 5, 1 para importância 1-2). Tipos:
  - "cloze": frase com a lacuna marcada por chaves duplas no termo-chave, ex.: "A {{mitocôndria}} produz ATP". back = o termo da lacuna.
  - "qa": pergunta curta em front, resposta curta em back.
- Cada carta testa UMA única informação. Nada de perguntas de sim ou não.`;

type FileIn = { path: string; mime: string; name: string };

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Analyze one chunk of material (some text and/or a few files) with the AI. */
export const analyzeChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ text: z.string().max(12000), files: z.array(z.object({ path: z.string(), mime: z.string(), name: z.string() })).max(4) }))
  .handler(async ({ data, context }): Promise<{ ok: true; result: ChunkResult } | { ok: false; reason: string; message: string }> => {
    const fail = (reason: string, message: string) => ({ ok: false as const, reason, message });
    const { data: block, error: blockError } = await context.supabase.from("ai_access_blocks").select("message").eq("user_id", context.userId).maybeSingle();
    if (blockError) return fail("access", "Não consegui conferir meu acesso agora. Tenta de novo? 🌊");
    if (block) return fail("denied", block.message);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return fail("config", "Meu acesso para ler o material precisa ser configurado. 🌱");
    const parts: UserContent = [];
    if (data.text.trim()) parts.push({ type: "text", text: `Material (texto):\n${data.text}` });
    for (const f of data.files) {
      if (!f.path.startsWith(`${context.userId}/`)) return fail("forbidden", "Esse material não está disponível na sua conta. 🌱");
      const { data: blob, error } = await context.supabase.storage.from("materials").download(f.path);
      if (error || !blob) return fail("file", "Não consegui abrir um dos arquivos. Envia ele de novo? 📄");
      const problem = fileProblem({ size: blob.size, type: blob.type }, f.mime === "application/pdf" ? "pdf" : "image");
      if (problem || blob.type !== f.mime) return fail("file", problem ?? "O formato desse arquivo não bate com o conteúdo. Escolhe outro? 📄");
      const bytes = await blob.arrayBuffer();
      if (f.mime === "application/pdf") {
        const problem = await pdfProblem(bytes);
        if (problem) return fail("file", problem);
      }
      const b64 = toBase64(bytes);
      if (f.mime === "application/pdf") parts.push({ type: "file", filename: f.name, data: b64, mediaType: "application/pdf" });
      else parts.push({ type: "image", image: new URL(`data:${f.mime};base64,${b64}`) });
    }
    if (!parts.length) return fail("empty", "Me manda um material para começar 🌱");
    parts.push({ type: "text", text: "Gere a ilha seguindo as regras." });

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./run-id.server");
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions: INSTRUCTIONS,
        messages: [{ role: "user", content: parts }],
        output: Output.object({ schema: resultSchema }),
        maxRetries: 0,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const output = await result.output;
      if (!output.concepts.length || !output.cards.length) return fail("empty", "Não encontrei trechos legíveis suficientes para criar cartas. Escolhe outro material? 🌱");
      return { ok: true, result: output };
    } catch (error: unknown) {
      const e = error as { statusCode?: number; responseBody?: string; lastError?: { statusCode?: number; responseBody?: string } };
      const status = e.statusCode ?? e.lastError?.statusCode;
      let message: string | undefined;
      try {
        const body = JSON.parse(e.responseBody ?? e.lastError?.responseBody ?? "{}") as { message?: string; error?: { message?: string } };
        message = body.message ?? body.error?.message;
      } catch { /* Never display a raw stack or provider payload. */ }
      console.error("analyzeChunk failed", status);
      const safeMessage = message ?? (status === 402 ? "As estrelinhas de IA acabaram. O responsável precisa adicionar créditos para continuar 🌟" : status === 403 ? "Meu acesso para ler material está pausado. O responsável precisa restabelecer o acesso 💕" : status === 429 ? "Tem muita gente estudando agora. Espera um pouquinho antes de tentar de novo 🌊" : status === 404 ? "A IA que lê o material está indisponível. Vamos esperar ela voltar 🌱" : "Não consegui ler seu material agora. Tenta de novo? 🌱");
      if (status === 403) {
        const { error: saveError } = await context.supabase.from("ai_access_blocks").upsert({ user_id: context.userId, message: safeMessage });
        if (saveError) console.error("Failed to persist AI access block");
      }
      return fail(status === 403 ? "denied" : status === 402 ? "credits" : status === 429 ? "busy" : status === 404 ? "unavailable" : "ai", safeMessage);
    }
  });

/** Persist the merged concept tree + cards and make every card due today. */
export const saveIslandContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ islandId: z.uuid(), name: z.string().min(1).max(200), emoji: z.string().max(30), concepts: z.array(conceptSchema).min(1), cards: z.array(cardSchema).min(1) }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const ids = new Map<string, string>();
    for (const c of data.concepts) ids.set(c.key, crypto.randomUUID());
    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(n)));
    const concepts = data.concepts.map((c) => {
      const id = ids.get(c.key);
      if (!id) throw new Error("save");
      return ({
      id, island_id: data.islandId,
      parent_id: c.parent_key ? ids.get(c.parent_key) ?? null : null,
      title: c.title.slice(0, 200), summary: c.summary, depth: clamp(c.depth, 0, 2),
      importance: clamp(c.importance, 1, 5), source_quote: c.source_quote,
    }); });
    // parents first so the self-reference is satisfied
    concepts.sort((a, b) => a.depth - b.depth);
    const up = await sb.from("islands").update({ name: data.name, emoji: data.emoji }).eq("id", data.islandId);
    if (up.error) throw new Error("save");
    for (let d = 0; d <= 2; d++) {
      const batch = concepts.filter((c) => c.depth === d);
      if (batch.length) { const r = await sb.from("concepts").insert(batch); if (r.error) throw new Error("save"); }
    }
    const cards = data.cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => ({
      id: crypto.randomUUID(), island_id: data.islandId, concept_id: ids.get(c.concept_key) ?? null,
      type: c.type, front: c.front, back: c.back, source_quote: c.source_quote,
    }));
    if (cards.length) {
      const r = await sb.from("cards").insert(cards); if (r.error) throw new Error("save");
      const s = await sb.from("card_states").insert(cards.map((c) => ({ card_id: c.id, user_id: context.userId, due_at: new Date().toISOString() })));
      if (s.error) throw new Error("save");
    }
    const sources = await sb.from("sources").update({ status: "done" }).eq("island_id", data.islandId);
    if (sources.error) throw new Error("save");
    return { cards: cards.length, concepts: concepts.length };
  });

/** Only called after the student explicitly confirms that access was restored. */
export const confirmAiAccessRestored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("ai_access_blocks").delete().eq("user_id", context.userId);
    if (error) throw new Error("access");
    return { ok: true };
  });
