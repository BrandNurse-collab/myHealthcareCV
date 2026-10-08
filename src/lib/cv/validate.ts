// Validates an uploaded CV before it ever reaches Storage or an AI call.
// Content-sniffs the first few bytes rather than trusting the filename
// extension or the browser-supplied MIME type alone (Section 19).

export const CV_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — matches supabase/storage.sql

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // "%PDF"
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04" — .docx is a zip container

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type CvFileValidation =
  | { ok: true; fileType: "pdf" | "docx" }
  | { ok: false; error: string };

export function validateCvFile(
  filename: string,
  declaredMimeType: string,
  size: number,
  bytes: Buffer
): CvFileValidation {
  if (size <= 0) {
    return { ok: false, error: "The file appears to be empty." };
  }
  if (size > CV_MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File is larger than the ${CV_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`,
    };
  }

  const extension = filename.toLowerCase().split(".").pop();
  const declaredPdf = extension === "pdf" || declaredMimeType === "application/pdf";
  const declaredDocx = extension === "docx" || declaredMimeType === DOCX_MIME;

  if (!declaredPdf && !declaredDocx) {
    return { ok: false, error: "Only PDF and Word (.docx) files are supported." };
  }

  if (declaredPdf) {
    if (!bytes.subarray(0, 4).equals(PDF_MAGIC)) {
      return { ok: false, error: "This doesn't look like a valid PDF file." };
    }
    return { ok: true, fileType: "pdf" };
  }

  if (!bytes.subarray(0, 4).equals(ZIP_MAGIC)) {
    return { ok: false, error: "This doesn't look like a valid Word (.docx) file." };
  }
  return { ok: true, fileType: "docx" };
}
