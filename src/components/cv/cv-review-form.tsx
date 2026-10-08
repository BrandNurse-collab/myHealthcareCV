"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntryListEditor } from "./entry-list-editor";
import { StringListField } from "./string-list-field";
import type {
  CvStructuredData,
  CvEmploymentEntry,
  CvEducationEntry,
  CvCertificationEntry,
  CvPublicationEntry,
  CvProjectEntry,
  CvAwardEntry,
  CvTrainingEntry,
} from "@/types/cv";

const EMPLOYMENT_FIELDS = [
  { key: "jobTitle" as const, label: "Job title", kind: "text" as const },
  { key: "employer" as const, label: "Employer", kind: "text" as const },
  { key: "location" as const, label: "Location", kind: "text" as const },
  { key: "startDate" as const, label: "Start date", kind: "text" as const },
  { key: "endDate" as const, label: "End date", kind: "text" as const },
  { key: "responsibilities" as const, label: "Responsibilities", kind: "lines" as const },
  { key: "achievements" as const, label: "Achievements", kind: "lines" as const },
];

const EDUCATION_FIELDS = [
  { key: "qualification" as const, label: "Qualification", kind: "text" as const },
  { key: "institution" as const, label: "Institution", kind: "text" as const },
  { key: "location" as const, label: "Location", kind: "text" as const },
  { key: "startDate" as const, label: "Start date", kind: "text" as const },
  { key: "endDate" as const, label: "End date", kind: "text" as const },
  { key: "notes" as const, label: "Notes", kind: "textarea" as const },
];

const CERTIFICATION_FIELDS = [
  { key: "name" as const, label: "Certification", kind: "text" as const },
  { key: "issuer" as const, label: "Issuer", kind: "text" as const },
  { key: "dateObtained" as const, label: "Date obtained", kind: "text" as const },
  { key: "expiryDate" as const, label: "Expiry date", kind: "text" as const },
];

const PUBLICATION_FIELDS = [
  { key: "citation" as const, label: "Citation", kind: "textarea" as const },
  { key: "year" as const, label: "Year", kind: "text" as const },
];

const PROJECT_FIELDS = [
  { key: "name" as const, label: "Project", kind: "text" as const },
  { key: "role" as const, label: "Role", kind: "text" as const },
  { key: "dateRange" as const, label: "Date range", kind: "text" as const },
  { key: "description" as const, label: "Description", kind: "textarea" as const },
];

const AWARD_FIELDS = [
  { key: "name" as const, label: "Award", kind: "text" as const },
  { key: "issuer" as const, label: "Issuer", kind: "text" as const },
  { key: "date" as const, label: "Date", kind: "text" as const },
];

const TRAINING_FIELDS = [
  { key: "name" as const, label: "Training", kind: "text" as const },
  { key: "provider" as const, label: "Provider", kind: "text" as const },
  { key: "date" as const, label: "Date", kind: "text" as const },
];

export function CvReviewForm({
  uploadedCvId,
  initialData,
  onSave,
}: {
  uploadedCvId: string;
  initialData: CvStructuredData;
  onSave: (uploadedCvId: string, data: CvStructuredData) => Promise<void>;
}) {
  const [data, setData] = useState<CvStructuredData>(initialData);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function set<K extends keyof CvStructuredData>(key: K, value: CvStructuredData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(uploadedCvId, data);
    } finally {
      // onSave redirects on success; this only runs if it threw instead.
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10 pb-24">
      <section className="space-y-4">
        <h2 className="font-serif text-lg text-ink">Basics</h2>
        <label className="block">
          <span className="text-sm font-medium text-ink/80">Name</span>
          <input
            value={data.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink/80">Professional title</span>
          <input
            value={data.professionalTitle ?? ""}
            onChange={(e) => set("professionalTitle", e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink/80">Professional summary</span>
          <textarea
            value={data.professionalSummary ?? ""}
            onChange={(e) => set("professionalSummary", e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink/80">Email</span>
            <input
              value={data.contact?.email ?? ""}
              onChange={(e) => set("contact", { ...data.contact, email: e.target.value })}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink/80">Phone</span>
            <input
              value={data.contact?.phone ?? ""}
              onChange={(e) => set("contact", { ...data.contact, phone: e.target.value })}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink/80">Location</span>
            <input
              value={data.contact?.location ?? ""}
              onChange={(e) => set("contact", { ...data.contact, location: e.target.value })}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink/80">LinkedIn</span>
            <input
              value={data.contact?.linkedin ?? ""}
              onChange={(e) => set("contact", { ...data.contact, linkedin: e.target.value })}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
            />
          </label>
        </div>
      </section>

      <EntryListEditor<CvEmploymentEntry>
        label="Employment history"
        entries={data.employmentHistory ?? []}
        onChange={(v) => set("employmentHistory", v)}
        fields={EMPLOYMENT_FIELDS}
        emptyEntry={{}}
      />

      <EntryListEditor<CvEducationEntry>
        label="Education"
        entries={data.education ?? []}
        onChange={(v) => set("education", v)}
        fields={EDUCATION_FIELDS}
        emptyEntry={{}}
      />

      <EntryListEditor<CvCertificationEntry>
        label="Certifications"
        entries={data.certifications ?? []}
        onChange={(v) => set("certifications", v)}
        fields={CERTIFICATION_FIELDS}
        emptyEntry={{}}
      />

      <StringListField
        label="Professional registrations / licenses"
        values={data.professionalRegistrationsLicenses ?? []}
        onChange={(v) => set("professionalRegistrationsLicenses", v)}
      />

      <StringListField
        label="Skills"
        values={data.skills ?? []}
        onChange={(v) => set("skills", v)}
      />

      <EntryListEditor<CvPublicationEntry>
        label="Publications"
        entries={data.publications ?? []}
        onChange={(v) => set("publications", v)}
        fields={PUBLICATION_FIELDS}
        emptyEntry={{}}
      />

      <StringListField
        label="Research"
        values={data.research ?? []}
        onChange={(v) => set("research", v)}
      />

      <EntryListEditor<CvProjectEntry>
        label="Projects"
        entries={data.projects ?? []}
        onChange={(v) => set("projects", v)}
        fields={PROJECT_FIELDS}
        emptyEntry={{}}
      />

      <EntryListEditor<CvEmploymentEntry>
        label="Volunteer experience"
        entries={data.volunteerExperience ?? []}
        onChange={(v) => set("volunteerExperience", v)}
        fields={EMPLOYMENT_FIELDS}
        emptyEntry={{}}
      />

      <EntryListEditor<CvAwardEntry>
        label="Awards"
        entries={data.awards ?? []}
        onChange={(v) => set("awards", v)}
        fields={AWARD_FIELDS}
        emptyEntry={{}}
      />

      <EntryListEditor<CvTrainingEntry>
        label="Training"
        entries={data.training ?? []}
        onChange={(v) => set("training", v)}
        fields={TRAINING_FIELDS}
        emptyEntry={{}}
      />

      <StringListField
        label="Languages"
        values={data.languages ?? []}
        onChange={(v) => set("languages", v)}
      />

      <label className="block">
        <span className="text-sm font-medium text-ink/80">Other</span>
        <span className="block text-xs text-ink/50">Anything that didn&rsquo;t fit a section above.</span>
        <textarea
          value={data.other ?? ""}
          onChange={(e) => set("other", e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
        />
      </label>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-line bg-paper/95 py-4 backdrop-blur">
        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-navy px-6 py-3 font-medium text-paper hover:bg-navy-dark disabled:opacity-60"
        >
          {saving ? "Saving\u2026" : "Save and continue"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="text-sm font-medium text-ink/60 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
