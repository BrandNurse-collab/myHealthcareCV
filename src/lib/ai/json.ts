// Shared by every AI stage that asks for jsonMode output (Section 24: CV
// extraction, job analysis, and — in later phases — matching, gap
// analysis, optimization, and QA all parse their model response the same
// way). Centralised so a fix to fence-stripping or error messaging doesn't
// need to be repeated per stage.

export function parseJsonCompletion<T>(text: string): T {
  const stripped = stripJsonFences(text);

  const direct = tryParseObject(stripped);
  if (direct) return direct as T;

  // Fallback for a response that's valid JSON *surrounded* by something else
  // — a stray leading/trailing sentence, or (seen in practice with Gemini)
  // output that was cut off mid-structure by the token limit. Try the
  // substring between the first "{" and the last "}" before giving up
  // entirely; this never fires for already-clean output.
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const salvaged = tryParseObject(stripped.slice(first, last + 1));
    if (salvaged) return salvaged as T;
  }

  // Every recovery attempt failed. Log what actually came back — without
  // this, a parse failure is a dead end with no way to tell truncation
  // apart from the model ignoring the format entirely (see the extraction
  // failure that led here: the error the user saw said only "AI call did
  // not return valid JSON," with nothing to diagnose further from).
  console.error(
    "parseJsonCompletion: could not parse model output as JSON.",
    "First 2000 chars:",
    stripped.slice(0, 2000),
    stripped.length > 2000 ? `... [${stripped.length} chars total]` : ""
  );
  throw new Error("AI call did not return valid JSON.");
}

function tryParseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}
