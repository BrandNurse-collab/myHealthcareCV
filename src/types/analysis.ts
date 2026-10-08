// Output of the matching/gap-analysis stage (Section 6, Stages 3-4) — CV
// vs. one job target's requirements. This is the shape the AI call in
// src/lib/analysis/run-match-analysis.ts must return, what gets persisted
// onto cv_analyses, and what the target detail page renders.

export interface MatchItem {
  /** The requirement being matched against — a skill, qualification, responsibility, etc. */
  requirement: string;
  /** What in the CV supports this — the explainability requirement: never a bare label with no evidence. */
  evidence: string;
}

export type GapCategory = "certification" | "education" | "experience" | "skill" | "other";

export interface GapItem {
  requirement: string;
  category: GapCategory;
  /** Ties to weighting: a gap in a "required" item should weigh more heavily on the score than "preferred". */
  severity: "required" | "preferred";
}

export interface CvMatchAnalysis {
  overallMatchScore: number; // 0-100
  strongMatches: MatchItem[];
  partialMatches: MatchItem[];
  /** Gaps that aren't a certification, education, or experience gap specifically (e.g. a missing skill or licensing requirement). */
  gaps: GapItem[];
  certificationGaps: GapItem[];
  educationGaps: GapItem[];
  experienceGaps: GapItem[];
  atsKeywordsFound: string[];
  atsKeywordsMissing: string[];
  recommendations: string[];
  /** One or two sentences on how the score was derived — the explainability the brief asks for, in the model's own words. */
  scoringNotes?: string;
}
