// Matches the job_targets.experience_level CHECK constraint in
// supabase/schema.sql — this is the one genuinely closed list in the
// targeting system (Section 3 specifies these exact options; everything
// else — job title, profession, career direction — is free text).
export const EXPERIENCE_LEVELS: { value: string; label: string }[] = [
  { value: "entry", label: "Entry level" },
  { value: "early_career", label: "Early career" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "management", label: "Management / Leadership" },
  { value: "executive", label: "Executive" },
  { value: "academic_research", label: "Academic / Research" },
  { value: "other", label: "Other" },
];

export function experienceLevelLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return EXPERIENCE_LEVELS.find((l) => l.value === value)?.label ?? value;
}
