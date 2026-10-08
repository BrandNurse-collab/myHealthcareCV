import mammoth from "mammoth";

// Imported from pdf-parse's internal entry point rather than the package
// root: the package root (index.js) contains a debug snippet that tries to
// read a test fixture off disk under some bundlers/runtimes. The internal
// lib path skips that entirely — see src/types/pdf-parse.d.ts for the
// (hand-written; the package ships no types) declaration this needs.
async function extractTextFromPdf(bytes: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const result = await pdfParse(bytes);
  return result.text;
}

async function extractTextFromDocx(bytes: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: bytes });
  return result.value;
}

export async function extractCvText(
  fileType: "pdf" | "docx",
  bytes: Buffer
): Promise<string> {
  const text =
    fileType === "pdf" ? await extractTextFromPdf(bytes) : await extractTextFromDocx(bytes);

  const trimmed = text.trim();
  if (trimmed.length < 30) {
    // Catches image-only/scanned PDFs, which pdf-parse can't read — Section
    // 15's "no problematic tables" concern has a cousin here: a scanned CV
    // silently producing near-empty text is worse than failing loudly.
    throw new Error(
      "Couldn't find readable text in this file. If it's a scanned or image-based PDF, try exporting a text-based version instead."
    );
  }
  return trimmed;
}
