import type { CvMatchAnalysis, GapItem, MatchItem } from "@/types/analysis";

/** A cv_analyses row as it comes back from Supabase (snake_case, jsonb columns untyped). */
export interface AnalysisRow {
  id: string;
  match_score: number | null;
  strong_matches: MatchItem[] | null;
  partial_matches: MatchItem[] | null;
  gaps: GapItem[] | null;
  certification_gaps: GapItem[] | null;
  education_gaps: GapItem[] | null;
  experience_gaps: GapItem[] | null;
  keyword_analysis: { found?: string[]; missing?: string[] } | null;
  recommendations: string[] | null;
  scoring_notes: string | null;
  basis: "job_description" | "title_only" | null;
  analysis_model: string | null;
  created_at: string;
}

export interface StoredAnalysis {
  id: string;
  analysis: CvMatchAnalysis;
  basis: "job_description" | "title_only" | null;
  createdAt: string;
}

export const ANALYSIS_COLUMNS =
  "id, match_score, strong_matches, partial_matches, gaps, certification_gaps, education_gaps, experience_gaps, keyword_analysis, recommendations, scoring_notes, basis, analysis_model, created_at";

export function analysisFromRow(row: AnalysisRow): StoredAnalysis {
  return {
    id: row.id,
    basis: row.basis,
    createdAt: row.created_at,
    analysis: {
      overallMatchScore: row.match_score ?? 0,
      strongMatches: row.strong_matches ?? [],
      partialMatches: row.partial_matches ?? [],
      gaps: row.gaps ?? [],
      certificationGaps: row.certification_gaps ?? [],
      educationGaps: row.education_gaps ?? [],
      experienceGaps: row.experience_gaps ?? [],
      atsKeywordsFound: row.keyword_analysis?.found ?? [],
      atsKeywordsMissing: row.keyword_analysis?.missing ?? [],
      recommendations: row.recommendations ?? [],
      scoringNotes: row.scoring_notes ?? undefined,
    },
  };
}
