import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fileProblem, pdfProblem, MAX_IMAGES, textChunks } from "./material";

describe("material de estudo", () => {
  it("aceita até 15 MB e rejeita arquivos maiores", () => {
    expect(fileProblem({ size: 15 * 1024 * 1024, type: "image/jpeg" }, "image")).toBeNull();
    expect(fileProblem({ size: 15 * 1024 * 1024 + 1, type: "image/jpeg" }, "image")).not.toBeNull();
  });
  it("aceita PDF com 50 páginas e rejeita 51", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 50; i++) doc.addPage();
    expect(await pdfProblem(new Uint8Array(await doc.save()).buffer)).toBeNull();
    doc.addPage();
    expect(await pdfProblem(new Uint8Array(await doc.save()).buffer)).not.toBeNull();
  });
  it("limita fotos a 10", () => { expect(MAX_IMAGES).toBe(10); });
  it("rejeita formatos que não são imagens", () => {
    expect(fileProblem({ size: 100, type: "text/plain" }, "image")).not.toBeNull();
  });
  it("divide texto grande sem perder nenhum trecho", () => {
    const text = "a".repeat(25000);
    expect(textChunks(text).map((s) => s.length)).toEqual([12000, 12000, 1000]);
    expect(textChunks(text).join("")).toBe(text);
  });
});