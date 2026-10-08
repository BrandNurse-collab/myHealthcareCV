import type { JobDescriptionExtractedData } from "@/types/job";

const SECTIONS: { key: keyof JobDescriptionExtractedData; label: string }[] = [
  { key: "requiredQualifications", label: "Required qualifications" },
  { key: "preferredQualifications", label: "Preferred qualifications" },
  { key: "responsibilities", label: "Responsibilities" },
  { key: "technicalSkills", label: "Technical skills" },
  { key: "professionalSkills", label: "Professional skills" },
  { key: "softSkills", label: "Soft skills" },
  { key: "certifications", label: "Certifications" },
  { key: "educationRequirements", label: "Education requirements" },
  { key: "regulatoryLicensingRequirements", label: "Regulatory / licensing requirements" },
  { key: "countrySpecificRequirements", label: "Country-specific requirements" },
  { key: "industryTerminology", label: "Industry terminology" },
  { key: "keywords", label: "Keywords" },
];

export function JdExtractedView({ data }: { data: JobDescriptionExtractedData }) {
  const hasHeader = data.jobTitle || data.employer || data.yearsOfExperience;

  return (
    <div className="space-y-6">
      {hasHeader && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/70">
          {data.jobTitle && (
            <span>
              <span className="text-ink/40">Posted title:</span> {data.jobTitle}
            </span>
          )}
          {data.employer && (
            <span>
              <span className="text-ink/40">Employer:</span> {data.employer}
            </span>
          )}
          {data.yearsOfExperience && (
            <span>
              <span className="text-ink/40">Experience:</span> {data.yearsOfExperience}
            </span>
          )}
        </div>
      )}

      {SECTIONS.map(({ key, label }) => {
        const items = data[key];
        if (!Array.isArray(items) || items.length === 0) return null;
        return (
          <div key={key}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="rounded-sm border border-line bg-white px-2.5 py-1 text-sm text-ink/80"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
