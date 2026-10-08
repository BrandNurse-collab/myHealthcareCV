import { renderToStaticMarkup } from "react-dom/server";
import { MatchAnalysisView } from "@/components/analysis/match-analysis-view";
import type { CvMatchAnalysis } from "@/types/analysis";

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("PASS", label); else { failures++; console.log("FAIL", label, extra ?? ""); }
}

const full: CvMatchAnalysis = {
  overallMatchScore: 72,
  strongMatches: [{ requirement: "Claims adjudication", evidence: "Adjudicated claims at Meridian" }],
  partialMatches: [{ requirement: "Provider management", evidence: "Handled provider queries" }],
  gaps: [{ requirement: "SQL", category: "skill", severity: "preferred" }],
  certificationGaps: [{ requirement: "CPC certification", category: "certification", severity: "required" }],
  educationGaps: [],
  experienceGaps: [{ requirement: "5+ years", category: "experience", severity: "required" }],
  atsKeywordsFound: ["claims adjudication"],
  atsKeywordsMissing: ["provider network"],
  recommendations: ["Lead with claims scale", "Move certifications higher"],
  scoringNotes: "Strong core fit; missing a required certification.",
};

const html = renderToStaticMarkup(<MatchAnalysisView analysis={full} basis="job_description" />);
check("shows 72%", html.includes("72%"));
check("band label present (not color-only)", html.includes("Partial alignment"));
check("explainability notes shown", html.includes("missing a required certification"));
check("evidence shown for strong match", html.includes("In your CV:") && html.includes("Adjudicated claims at Meridian"));
check("'Not found in your CV' framing, with count 3", html.includes("Not found in your CV") && html.includes("(3)"));
check("'doesn't mean you don't have them' caveat present", html.includes("don&#x27;t have them") || html.includes("don’t have them") || html.includes("don&rsquo;t have them") || /have them/.test(html));
check("group: Certifications", html.includes("Certifications") && html.includes("CPC certification"));
check("group: Experience", html.includes("Experience") && html.includes("5+ years"));
check("group: Education omitted when empty", !html.includes(">Education<"));
check("Required + Preferred tags both rendered", html.includes("Required") && html.includes("Preferred"));
check("keywords found + missing", html.includes("claims adjudication") && html.includes("provider network"));
check("recommendations as ordered list", html.includes("<ol") && html.includes("Move certifications higher"));
check("disclaimer: not an official ATS score", html.includes("not an official ATS score"));
check("job_description basis wording", html.includes("Based on the pasted job description"));
check("bar width reflects score", html.includes("width:72%"));

const titleOnly = renderToStaticMarkup(<MatchAnalysisView analysis={full} basis="title_only" />);
check("title_only basis warns lower confidence", titleOnly.includes("lower-confidence"));

const low = renderToStaticMarkup(<MatchAnalysisView analysis={{ ...full, overallMatchScore: 30 }} basis={null} />);
check("low score band", low.includes("Significant gaps"));
const high = renderToStaticMarkup(<MatchAnalysisView analysis={{ ...full, overallMatchScore: 90 }} basis={null} />);
check("high score band", high.includes("Strong alignment"));

const empty = renderToStaticMarkup(
  <MatchAnalysisView
    analysis={{ overallMatchScore: 10, strongMatches: [], partialMatches: [], gaps: [], certificationGaps: [], educationGaps: [], experienceGaps: [], atsKeywordsFound: [], atsKeywordsMissing: [], recommendations: [] }}
    basis="job_description"
  />
);
check("empty state: strong matches", empty.includes("No requirements were clearly supported"));
check("empty state: missing requirements", empty.includes("No missing requirements identified"));
check("empty state: keywords", empty.includes("None of the posting") && empty.includes("No missing keywords identified"));
check("empty state: suggestions", empty.includes("No suggestions returned"));
check("no empty headings anywhere", !/<h[1-6][^>]*><\/h[1-6]>/.test(empty + html));

const xss = renderToStaticMarkup(<MatchAnalysisView analysis={{ ...full, strongMatches: [{ requirement: "<script>alert(1)</script>", evidence: "<img src=x onerror=alert(1)>" }] }} basis={null} />);
check("model output is escaped, not injected as HTML", !xss.includes("<script>alert") && !xss.includes("<img src=x"));

console.log(failures === 0 ? "\nALL RENDER CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
