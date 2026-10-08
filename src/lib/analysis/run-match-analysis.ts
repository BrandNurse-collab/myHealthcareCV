import { getAIProvider } from "@/lib/ai/provider";
import {
  MATCHING_SYSTEM_PROMPT,
  MATCHING_PROMPT_VERSION,
} from "@/lib/ai/prompts/matching";
import { parseJsonCompletion } from "@/lib/ai/json";
import { env } from "@/lib/config/env";
import type { CvStructuredData } from "@/types/cv";
import type { JobDescriptionExtractedData } from "@/types/job";
import type { CvMatchAnalysis, GapCategory, GapItem, MatchItem } from "@/types/analysis";

export interface MatchTargetInput {
  targetJobTitle: string;
  profession?: string | null;
  country?: string | null;
  experienceLevel?: string | null;
  careerDirection?: string | null;
  /** Structured requirements from a pasted posting — the strongest signal when present (Section 23). */
  jobDescription?: JobDescriptionExtractedData | null;
}

export type MatchBasis = "job_description" | "title_only";

export interface MatchAnalysisResult {
  analysis: CvMatchAnalysis;
  basis: MatchBasis;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runMatchAnalysis(
  cv: CvStructuredData,
  target: MatchTargetInput
): Promise<MatchAnalysisResult> {
  const provider = await getAIProvider();

  // Data minimization: matching never needs the candidate's name or contact
  // details, so they never leave our server for the AI provider.
  const cvForMatching: CvStructuredData = { ...cv };
  delete cvForMatching.name;
  delete cvForMatching.contact;

  const basis: MatchBasis = target.jobDescription ? "job_description" : "title_only";

  const payload = {
    cv: cvForMatching,
    target: {
      targetJobTitle: target.targetJobTitle,
      ...(target.profession ? { profession: target.profession } : {}),
      ...(target.country ? { country: target.country } : {}),
      ...(target.experienceLevel ? { experienceLevel: target.experienceLevel } : {}),
      ...(target.careerDirection ? { careerDirection: target.careerDirection } : {}),
      ...(target.jobDescription ? { jobDescription: target.jobDescription } : {}),
    },
  };

  const result = await provider.complete({
    system: MATCHING_SYSTEM_PROMPT,
    prompt: JSON.stringify(payload),
    model: env.ai.model(), // the stronger model on purpose — this is the analysis the user pays to see; see ARCHITECTURE.md
    jsonMode: true,
    maxTokens: 6000,
    temperature: 0.1,
  });

  const raw = parseJsonCompletion<Record<string, unknown>>(result.text);

  return {
    analysis: normalizeAnalysis(raw),
    basis,
    model: result.model,
    promptVersion: MATCHING_PROMPT_VERSION,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// ── Normalization ─────────────────────────────────────────────────────────
// Models occasionally omit a key, return the wrong type, or mislabel a
// category. This is the last line of defence before the output is stored and
// shown to a paying user, so it repairs what's safely repairable and refuses
// what isn't (a missing score is never silently stored as 0).

const NOT_CITED = "The analysis flagged this as a match but did not cite specific supporting evidence from the CV.";

export function normalizeAnalysis(raw: Record<string, unknown>): CvMatchAnalysis {
  const score = Number(raw.overallMatchScore);
  if (!Number.isFinite(score)) {
    throw new Error("Match analysis response did not include a valid score.");
  }

  const strong = toMatchItems(raw.strongMatches);
  const partial = toMatchItems(raw.partialMatches);

  // A "strong" match with no cited evidence is an unsupported claim — the
  // exact thing this product exists to prevent. Demote it rather than show it.
  const supportedStrong: MatchItem[] = [];
  for (const item of strong) {
    if (item.evidence) {
      supportedStrong.push(item);
    } else {
      partial.push({ requirement: item.requirement, evidence: NOT_CITED });
    }
  }

  return {
    overallMatchScore: Math.min(100, Math.max(0, Math.round(score))),
    strongMatches: supportedStrong,
    partialMatches: partial,
    gaps: toGapItems(raw.gaps, "other", ["skill", "other"]),
    certificationGaps: toGapItems(raw.certificationGaps, "certification"),
    educationGaps: toGapItems(raw.educationGaps, "education"),
    experienceGaps: toGapItems(raw.experienceGaps, "experience"),
    atsKeywordsFound: toStringList(raw.atsKeywordsFound),
    atsKeywordsMissing: toStringList(raw.atsKeywordsMissing),
    recommendations: toStringList(raw.recommendations),
    scoringNotes: typeof raw.scoringNotes === "string" ? raw.scoringNotes.trim() : undefined,
  };
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

function toMatchItems(value: unknown): MatchItem[] {
  if (!Array.isArray(value)) return [];
  const items: MatchItem[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { requirement, evidence } = entry as Record<string, unknown>;
    if (typeof requirement !== "string" || !requirement.trim()) continue;
    items.push({
      requirement: requirement.trim(),
      evidence: typeof evidence === "string" ? evidence.trim() : "",
    });
  }
  return items;
}

function toGapItems(
  value: unknown,
  defaultCategory: GapCategory,
  allowedCategories?: GapCategory[]
): GapItem[] {
  if (!Array.isArray(value)) return [];
  const items: GapItem[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { requirement, category, severity } = entry as Record<string, unknown>;
    if (typeof requirement !== "string" || !requirement.trim()) continue;

    // The bucket a gap arrives in is authoritative for the dedicated
    // certification/education/experience lists; the general list only
    // accepts the categories that belong in it.
    const resolvedCategory: GapCategory = allowedCategories
      ? allowedCategories.includes(category as GapCategory)
        ? (category as GapCategory)
        : defaultCategory
      : defaultCategory;

    items.push({
      requirement: requirement.trim(),
      category: resolvedCategory,
      severity: severity === "required" ? "required" : "preferred",
    });
  }
  return items;
}
