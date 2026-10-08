// Shared by every AI stage that asks for jsonMode output (Section 24: CV
// extraction, job analysis, and — in later phases — matching, gap
// analysis, optimization, and QA all parse their model response the same
// way). Centralised so a fix to fence-stripping or error messaging doesn't
// need to be repeated per stage.

export function parseJsonCompletion<T>(text: string): T {
  const stripped = stripJsonFences(text);
  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as T;
  } catch {
    throw new Error("AI call did not return valid JSON.");
  }
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}
