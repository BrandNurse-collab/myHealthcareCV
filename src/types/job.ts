// What Stage 2 extraction (Section 4/6) pulls out of a pasted job
// description. Every field is a plain string or string[] — this is the
// employer's stated requirements, organized for matching, not a claim
// about the candidate, so it doesn't carry the same "never invent"
// constraint CvStructuredData does. It should still be faithful to what
// the posting actually says rather than synthesizing requirements the
// posting doesn't mention.

export interface JobDescriptionExtractedData {
  jobTitle?: string;
  employer?: string;
  requiredQualifications?: string[];
  preferredQualifications?: string[];
  yearsOfExperience?: string; // kept as free text — postings phrase this inconsistently
  technicalSkills?: string[];
  professionalSkills?: string[];
  softSkills?: string[];
  responsibilities?: string[];
  certifications?: string[];
  industryTerminology?: string[];
  keywords?: string[]; // ATS-relevant terms worth echoing in the optimized CV (Phase 4+)
  educationRequirements?: string[];
  regulatoryLicensingRequirements?: string[];
  countrySpecificRequirements?: string[];
}
