import { runMatchAnalysis, normalizeAnalysis } from "@/lib/analysis/run-match-analysis";
import type { CvStructuredData } from "@/types/cv";

process.env.AI_PROVIDER = "anthropic";
process.env.AI_API_KEY = "test-key";
process.env.AI_MODEL = "strong-model";
process.env.AI_MODEL_FAST = "fast-model";

let lastBody: any = null;
function mockModelReply(text: string, ok = true) {
  globalThis.fetch = (async (_url: any, init: any) => {
    lastBody = JSON.parse(init.body);
    if (!ok) return new Response("boom: secret detail", { status: 500 });
    return new Response(
      JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 1200, output_tokens: 800 } }),
      { status: 200 }
    );
  }) as typeof fetch;
}

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("PASS", label);
  else { failures++; console.log("FAIL", label, extra ?? ""); }
}

const cv: CvStructuredData = {
  name: "Adaeze Okonkwo",
  contact: { email: "adaeze@example.com", phone: "+234 801 234 5678" },
  professionalTitle: "Claims Officer",
  employmentHistory: [{ jobTitle: "Claims Officer", employer: "Meridian Health HMO", responsibilities: ["Adjudicated claims"] }],
  skills: ["Claims adjudication"],
};

const goodReply = {
  overallMatchScore: 72,
  strongMatches: [{ requirement: "Claims adjudication", evidence: "Adjudicated claims at Meridian Health HMO" }],
  partialMatches: [{ requirement: "Provider management", evidence: "Handled provider queries" }],
  gaps: [{ requirement: "SQL", category: "skill", severity: "preferred" }],
  certificationGaps: [{ requirement: "CPC certification", category: "certification", severity: "required" }],
  educationGaps: [],
  experienceGaps: [{ requirement: "5+ years", category: "experience", severity: "required" }],
  atsKeywordsFound: ["claims adjudication"],
  atsKeywordsMissing: ["provider network"],
  recommendations: ["Lead with claims adjudication scale"],
  scoringNotes: "Strong on core claims work; missing a required certification.",
};

(async () => {
  // 1. Happy path, fenced JSON, with a job description
  mockModelReply("```json\n" + JSON.stringify(goodReply) + "\n```");
  const r1 = await runMatchAnalysis(cv, {
    targetJobTitle: "Claims Analyst", profession: "HMO Operations", country: "Nigeria",
    jobDescription: { requiredQualifications: ["5+ years claims"] },
  });
  check("score parsed", r1.analysis.overallMatchScore === 72);
  check("basis = job_description", r1.basis === "job_description");
  check("strong model used (not fast)", lastBody.model === "strong-model", lastBody.model);
  check("candidate name NOT sent to provider", !JSON.stringify(lastBody).includes("Adaeze"));
  check("candidate email NOT sent to provider", !JSON.stringify(lastBody).includes("adaeze@example.com"));
  check("CV content IS sent", JSON.stringify(lastBody).includes("Meridian Health HMO"));
  check("job description IS sent", JSON.stringify(lastBody).includes("5+ years claims"));
  check("token usage carried through", r1.inputTokens === 1200 && r1.outputTokens === 800);
  check("prompt version recorded", r1.promptVersion === "matching-v1");
  check("temperature low", lastBody.temperature <= 0.2);

  // 2. No JD → title_only
  mockModelReply(JSON.stringify(goodReply));
  const r2 = await runMatchAnalysis(cv, { targetJobTitle: "Claims Analyst" });
  check("basis = title_only without JD", r2.basis === "title_only");
  const userPayload = JSON.parse(lastBody.messages[0].content);
  check("no jobDescription key in the user payload", !("jobDescription" in userPayload.target), Object.keys(userPayload.target));
  check("(sanity) the system prompt does mention jobDescription, which is what tripped the first version of this check", String(lastBody.system).includes("jobDescription"));

  // 3. Score clamping / coercion
  check("score >100 clamped", normalizeAnalysis({ ...goodReply, overallMatchScore: 150 }).overallMatchScore === 100);
  check("negative score clamped", normalizeAnalysis({ ...goodReply, overallMatchScore: -5 }).overallMatchScore === 0);
  check("string score coerced", normalizeAnalysis({ ...goodReply, overallMatchScore: "72.6" }).overallMatchScore === 73);

  // 4. Missing / invalid score must throw, never store 0
  let threw = false;
  try { normalizeAnalysis({ ...goodReply, overallMatchScore: undefined }); } catch { threw = true; }
  check("missing score throws (not stored as 0)", threw);
  threw = false;
  try { normalizeAnalysis({ ...goodReply, overallMatchScore: "high" }); } catch { threw = true; }
  check("non-numeric score throws", threw);

  // 5. Unsupported "strong" match is demoted
  const n5 = normalizeAnalysis({ ...goodReply, strongMatches: [
    { requirement: "Claims adjudication", evidence: "Adjudicated claims" },
    { requirement: "Fraud detection", evidence: "   " },
    { requirement: "Auditing" },
  ]});
  check("evidence-less strong matches removed from strong", n5.strongMatches.length === 1, n5.strongMatches);
  check("...and demoted into partial", n5.partialMatches.some(m => m.requirement === "Fraud detection") && n5.partialMatches.some(m => m.requirement === "Auditing"));
  check("demoted items say evidence was not cited", n5.partialMatches.filter(m => m.evidence.includes("did not cite")).length === 2);

  // 6. Category & severity repair
  const n6 = normalizeAnalysis({ ...goodReply,
    certificationGaps: [{ requirement: "CPC", category: "skill", severity: "REQUIRED?!" }],
    gaps: [{ requirement: "Degree", category: "education", severity: "required" }, { requirement: "Excel", category: "skill", severity: "required" }],
  });
  check("cert bucket forces category=certification", n6.certificationGaps[0]?.category === "certification");
  check("garbage severity -> preferred", n6.certificationGaps[0]?.severity === "preferred");
  check("general gaps reject education category -> other", n6.gaps[0]?.category === "other");
  check("general gaps keep valid 'skill'", n6.gaps[1]?.category === "skill");

  // 7. Wrong types → safe empties
  const n7 = normalizeAnalysis({ overallMatchScore: 50, strongMatches: "nope", partialMatches: null, gaps: {}, atsKeywordsFound: [1, "ok", null], recommendations: "x" });
  check("non-array fields become []", n7.strongMatches.length === 0 && n7.partialMatches.length === 0 && n7.gaps.length === 0 && n7.recommendations.length === 0);
  check("mixed-type string list filtered", JSON.stringify(n7.atsKeywordsFound) === '["ok"]', n7.atsKeywordsFound);
  check("junk entries skipped", normalizeAnalysis({ ...goodReply, partialMatches: [null, 5, { requirement: "" }, { requirement: "Real", evidence: "e" }] }).partialMatches.length === 1);

  // 8. Provider failure and malformed output both throw
  mockModelReply("", false);
  threw = false; try { await runMatchAnalysis(cv, { targetJobTitle: "x" }); } catch { threw = true; }
  check("HTTP 500 from provider throws", threw);
  mockModelReply("Sorry, I can't do that.");
  threw = false; try { await runMatchAnalysis(cv, { targetJobTitle: "x" }); } catch { threw = true; }
  check("non-JSON model output throws", threw);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
