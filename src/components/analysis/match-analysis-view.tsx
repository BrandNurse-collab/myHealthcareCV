import type { CvMatchAnalysis, GapItem, MatchItem } from "@/types/analysis";

function scoreBand(score: number) {
  if (score >= 75) return { label: "Strong alignment", bar: "bg-verdant", badge: "bg-verdant-light text-verdant" };
  if (score >= 50) return { label: "Partial alignment", bar: "bg-amber", badge: "border border-amber/40 bg-amber/10 text-ink" };
  return { label: "Significant gaps", bar: "bg-navy", badge: "border border-line bg-white text-ink" };
}

export function MatchAnalysisView({
  analysis,
  basis,
}: {
  analysis: CvMatchAnalysis;
  basis: "job_description" | "title_only" | null;
}) {
  const band = scoreBand(analysis.overallMatchScore);

  const missingGroups: { label: string; items: GapItem[] }[] = [
    { label: "Certifications", items: analysis.certificationGaps },
    { label: "Education", items: analysis.educationGaps },
    { label: "Experience", items: analysis.experienceGaps },
    { label: "Skills and other requirements", items: analysis.gaps },
  ];
  const totalMissing = missingGroups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-10">
      {/* Score */}
      <div className="rounded-sm border border-line bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink/70">CV-to-job alignment score</p>
            <p className="mt-1 font-serif text-5xl text-ink">{analysis.overallMatchScore}%</p>
          </div>
          <span className={`rounded-sm px-3 py-1 text-sm font-medium ${band.badge}`}>{band.label}</span>
        </div>
        <div className="mt-4 h-2 w-full rounded-sm bg-line" aria-hidden="true">
          <div className={`h-2 rounded-sm ${band.bar}`} style={{ width: `${analysis.overallMatchScore}%` }} />
        </div>
        {analysis.scoringNotes && (
          <p className="mt-4 max-w-prose text-ink/80">{analysis.scoringNotes}</p>
        )}
        <p className="mt-4 text-sm text-ink/70">
          {basis === "title_only"
            ? "Based on the job title and profession only — no job description was analyzed, so this is a lower-confidence estimate. "
            : "Based on the pasted job description. "}
          This is an AI estimate, not an official ATS score; real applicant tracking systems vary.
        </p>
      </div>

      <MatchList
        title="Strong matches"
        intro="Requirements your CV clearly supports."
        empty="No requirements were clearly supported by the CV as written."
        items={analysis.strongMatches}
      />

      <MatchList
        title="Partial matches"
        intro="Related or transferable experience — relevant, but not a direct match."
        empty="No partial matches identified."
        items={analysis.partialMatches}
      />

      {/* Missing requirements */}
      <section>
        <h3 className="font-serif text-xl text-ink">
          Not found in your CV <span className="text-base text-ink/70">({totalMissing})</span>
        </h3>
        <p className="mt-1 max-w-prose text-ink/70">
          These requirements aren&rsquo;t documented in your CV as written. That doesn&rsquo;t mean you
          don&rsquo;t have them — if you do, add them to your CV details. Nothing here will ever be added for you.
        </p>
        {totalMissing === 0 ? (
          <p className="mt-4 text-ink/70">No missing requirements identified.</p>
        ) : (
          <div className="mt-5 space-y-6">
            {missingGroups.map(
              (group) =>
                group.items.length > 0 && (
                  <div key={group.label}>
                    <h4 className="text-sm font-medium text-ink">{group.label}</h4>
                    <ul className="mt-2 divide-y divide-line border-y border-line">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex items-start justify-between gap-4 py-3">
                          <span className="text-ink/80">{item.requirement}</span>
                          <span
                            className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium ${
                              item.severity === "required"
                                ? "border border-amber/40 bg-amber/10 text-ink"
                                : "border border-line bg-white text-ink/70"
                            }`}
                          >
                            {item.severity === "required" ? "Required" : "Preferred"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
            )}
          </div>
        )}
      </section>

      {/* ATS keywords */}
      <section>
        <h3 className="font-serif text-xl text-ink">Keywords</h3>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-ink">Already in your CV</h4>
            <KeywordChips
              items={analysis.atsKeywordsFound}
              empty="None of the posting's key terms were found."
              tone="found"
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-ink">Worth adding where it&rsquo;s true</h4>
            <KeywordChips
              items={analysis.atsKeywordsMissing}
              empty="No missing keywords identified."
              tone="missing"
            />
          </div>
        </div>
      </section>

      {/* Recommendations */}
      <section>
        <h3 className="font-serif text-xl text-ink">Improvement suggestions</h3>
        {analysis.recommendations.length === 0 ? (
          <p className="mt-3 text-ink/70">No suggestions returned.</p>
        ) : (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink/80 marker:text-ink/70">
            {analysis.recommendations.map((r, i) => (
              <li key={i} className="max-w-prose pl-1">
                {r}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function MatchList({
  title,
  intro,
  empty,
  items,
}: {
  title: string;
  intro: string;
  empty: string;
  items: MatchItem[];
}) {
  return (
    <section>
      <h3 className="font-serif text-xl text-ink">
        {title} <span className="text-base text-ink/70">({items.length})</span>
      </h3>
      <p className="mt-1 text-ink/70">{intro}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-ink/70">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {items.map((item, i) => (
            <li key={i} className="py-4">
              <p className="font-medium text-ink">{item.requirement}</p>
              {item.evidence && (
                <p className="mt-1 max-w-prose text-sm text-ink/70">
                  <span className="font-medium text-ink/80">In your CV:</span> {item.evidence}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KeywordChips({
  items,
  empty,
  tone,
}: {
  items: string[];
  empty: string;
  tone: "found" | "missing";
}) {
  if (items.length === 0) return <p className="mt-2 text-sm text-ink/70">{empty}</p>;
  const style =
    tone === "found"
      ? "bg-verdant-light text-verdant"
      : "border border-amber/40 bg-amber/10 text-ink";
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((k, i) => (
        <li key={i} className={`rounded-sm px-2.5 py-1 text-sm ${style}`}>
          {k}
        </li>
      ))}
    </ul>
  );
}
