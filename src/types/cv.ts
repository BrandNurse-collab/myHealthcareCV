// The internal structured representation of a CV — what Stage 1 extraction
// (Section 6) produces, what the review screen lets the user correct, and
// what every later AI stage reads instead of re-parsing raw CV text.
//
// Every field is optional: a CV that doesn't mention publications shouldn't
// force the extractor to invent an empty-but-present shape it isn't sure
// about, and a missing field here is what feeds "not found in CV" in the
// gap analysis (Section 8) — it must never be silently defaulted away.

export interface CvContact {
  email?: string;
  phone?: string;
  location?: string; // city/state/country as written on the CV
  linkedin?: string;
  otherLinks?: string[];
}

export interface CvEmploymentEntry {
  jobTitle?: string;
  employer?: string;
  location?: string;
  startDate?: string; // kept as free text — CVs write dates inconsistently
  endDate?: string; // "" / "Present" both acceptable
  responsibilities?: string[];
  achievements?: string[];
}

export interface CvEducationEntry {
  qualification?: string;
  institution?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface CvCertificationEntry {
  name?: string;
  issuer?: string;
  dateObtained?: string;
  expiryDate?: string;
}

export interface CvPublicationEntry {
  citation?: string; // as written — never reformatted into a fabricated style
  year?: string;
}

export interface CvProjectEntry {
  name?: string;
  description?: string;
  role?: string;
  dateRange?: string;
}

export interface CvAwardEntry {
  name?: string;
  issuer?: string;
  date?: string;
}

export interface CvTrainingEntry {
  name?: string;
  provider?: string;
  date?: string;
}

export interface CvStructuredData {
  name?: string;
  contact?: CvContact;
  professionalTitle?: string;
  professionalSummary?: string;
  employmentHistory?: CvEmploymentEntry[];
  education?: CvEducationEntry[];
  certifications?: CvCertificationEntry[];
  professionalRegistrationsLicenses?: string[];
  skills?: string[];
  publications?: CvPublicationEntry[];
  research?: string[];
  projects?: CvProjectEntry[];
  volunteerExperience?: CvEmploymentEntry[];
  awards?: CvAwardEntry[];
  training?: CvTrainingEntry[];
  languages?: string[];
  other?: string;
}
