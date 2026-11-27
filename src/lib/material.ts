export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_IMAGES = 10;
export const MAX_PDF_PAGES = 50;
export const TEXT_CHUNK_SIZE = 12000;

export function fileProblem(file: { size: number; type: string }, kind: "pdf" | "image") {
  if (file.size === 0) return "O arquivo está vazio. Escolhe outro pra mim? 🌱";
  if (file.size > MAX_FILE_SIZE) return "Cada arquivo pode ter até 15 MB. Escolhe um menorzinho? 💕";
  if (kind === "pdf" ? file.type !== "application/pdf" : !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return kind === "pdf" ? "Preciso de um PDF nesse botão 📄" : "Escolhe uma foto JPG, PNG, WebP ou GIF pra eu conseguir ler 📷";
  }
  return null;
}

export async function pdfProblem(bytes: ArrayBuffer) {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    return doc.getPageCount() > MAX_PDF_PAGES ? "Cada PDF pode ter até 50 páginas. Divide ele em partes? 📄" : null;
  } catch {
    return "Não consegui abrir esse PDF. Ele pode estar protegido ou incompleto. Escolhe outro? 📄";
  }
}

export function textChunks(text: string) {
  const chunks: string[] = [];
  for (let i = 0; i < text.trim().length; i += TEXT_CHUNK_SIZE) chunks.push(text.trim().slice(i, i + TEXT_CHUNK_SIZE));
  return chunks;
}