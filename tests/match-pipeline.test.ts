import { processMatchAnalysis } from "@/lib/analysis/process-match-analysis";

process.env.AI_PROVIDER = "anthropic";
process.env.AI_API_KEY = "sk-secret-test-key";
process.env.AI_MODEL = "strong-model";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

const goodReply = {
  overallMatchScore: 72,
  strongMatches: [{ requirement: "Claims adjudication", evidence: "Adjudicated claims" }],
  partialMatches: [], gaps: [], educationGaps: [], experienceGaps: [],
  certificationGaps: [{ requirement: "CPC", category: "certification", severity: "required" }],
  atsKeywordsFound: ["claims"], atsKeywordsMissing: ["network"],
  recommendations: ["Lead with scale"], scoringNotes: "Missing a required certification.",
};

let modelCalls = 0;
let serviceInserts: { url: string; body: any }[] = [];
let supabaseStatus = 201;
let providerMode: "ok" | "fail" = "ok";

globalThis.fetch = (async (url: any, init: any) => {
  const u = String(url);
  if (u.includes("api.anthropic.com")) {
    modelCalls++;
    if (providerMode === "fail") return new Response("upstream said: invalid x-api-key sk-secret-test-key", { status: 401 });
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(goodReply) }], usage: { input_tokens: 1000, output_tokens: 500 } }), { status: 200 });
  }
  if (u.includes("supabase.co")) {
    serviceInserts.push({ url: u, body: init?.body ? JSON.parse(init.body) : null });
    return new Response("[]", { status: supabaseStatus, headers: { "content-type": "application/json" } });
  }
  throw new Error("unexpected fetch " + u);
}) as typeof fetch;

const baseData = () => ({
  job_targets: {
    id: "t1", cv_version_id: "v1", target_job_title: "Claims Analyst", profession_custom: null,
    experience_level: "mid", career_direction: null,
    professions: { name: "HMO Operations" }, countries: { name: "Nigeria" }, cv_versions: { uploaded_cv_id: "cv1" },
  } as any,
  cv_analyses: null as any,
  cv_extracted_data: { structured_data: { name: "Adaeze", skills: ["Claims"] } } as any,
  job_descriptions: { extracted_data: { requiredQualifications: ["5+ years"] } } as any,
});

function fake(data: Record<string, any>, inserts: { table: string; row: any }[], insertError: string | null = null) {
  return {
    from(table: string) {
      const q: any = {
        select: () => q, eq: () => q, order: () => q, limit: () => q,
        single: async () => ({ data: data[table] ?? null, error: null }),
        maybeSingle: async () => ({ data: data[table] ?? null, error: null }),
        insert: (row: any) => {
          inserts.push({ table, row });
          return { select: () => ({ single: async () => insertError ? ({ data: null, error: { message: insertError } }) : ({ data: { id: "new-analysis-id" }, error: null }) }) };
        },
      };
      return q;
    },
  } as any;
}

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) console.log("PASS", label); else { failures++; console.log("FAIL", label, extra ?? ""); }
}
const reset = () => { modelCalls = 0; serviceInserts = []; supabaseStatus = 201; providerMode = "ok"; };
const origError = console.error; 

(async () => {
  // A. happy path
  reset();
  let inserts: any[] = [];
  let r: any = await processMatchAnalysis(fake(baseData(), inserts), "t1");
  check("A: ok, fresh (not reused)", r.ok === true && r.reused === false, r);
  const row = inserts.find(i => i.table === "cv_analyses")?.row;
  check("A: exactly one cv_analyses insert", inserts.filter(i => i.table === "cv_analyses").length === 1);
  check("A: score stored in match_score", row?.match_score === 72);
  check("A: basis job_description", row?.basis === "job_description");
  check("A: prompt_version stored", row?.prompt_version === "matching-v1");
  check("A: model stored", row?.analysis_model === "strong-model");
  check("A: keywords stored as {found,missing}", JSON.stringify(row?.keyword_analysis) === JSON.stringify({ found: ["claims"], missing: ["network"] }));
  check("A: certification gap stored in its own column", row?.certification_gaps?.[0]?.requirement === "CPC");
  check("A: links to cv_version and job_target", row?.cv_version_id === "v1" && row?.job_target_id === "t1");
  const usage = serviceInserts.find(s => s.url.includes("ai_usage"));
  check("A: ai_usage logged via service client", !!usage, serviceInserts.map(s => s.url));
  check("A: ai_usage stage = matching, no job attached", usage?.body?.stage === "matching" && usage?.body?.optimization_job_id === null, usage?.body);
  check("A: ai_usage tokens recorded", usage?.body?.input_tokens === 1000 && usage?.body?.output_tokens === 500);

  // B. cooldown — a fresh analysis exists
  reset(); inserts = [];
  const dB = baseData(); dB.cv_analyses = { id: "existing", created_at: new Date().toISOString() };
  r = await processMatchAnalysis(fake(dB, inserts), "t1");
  check("B: cooldown reuses existing analysis", r.ok && r.reused === true && r.analysisId === "existing", r);
  check("B: no model call within cooldown", modelCalls === 0);
  check("B: nothing inserted within cooldown", inserts.length === 0);

  // C. old analysis → runs again
  reset(); inserts = [];
  const dC = baseData(); dC.cv_analyses = { id: "old", created_at: new Date(Date.now() - 120_000).toISOString() };
  r = await processMatchAnalysis(fake(dC, inserts), "t1");
  check("C: analysis older than cooldown re-runs", r.ok && r.reused === false && modelCalls === 1, r);

  // D. no extracted CV
  reset(); inserts = [];
  const dD = baseData(); dD.cv_extracted_data = null;
  r = await processMatchAnalysis(fake(dD, inserts), "t1");
  check("D: no extracted CV -> clear error", r.ok === false && /extracted/i.test(r.error), r);
  check("D: no model call, no insert", modelCalls === 0 && inserts.length === 0);

  // E. provider failure -> generic message, no leakage
  reset(); inserts = []; providerMode = "fail"; console.error = () => {};
  r = await processMatchAnalysis(fake(baseData(), inserts), "t1");
  console.error = origError;
  check("E: provider failure returns ok:false", r.ok === false);
  check("E: user-facing error hides API key & provider detail", !/sk-secret|x-api-key|401|upstream/i.test(r.error), r.error);
  check("E: nothing stored on failure", inserts.length === 0);

  // F. target not found
  reset(); inserts = [];
  const dF = baseData(); dF.job_targets = null;
  r = await processMatchAnalysis(fake(dF, inserts), "t1");
  check("F: missing target -> ok:false, no model call", r.ok === false && modelCalls === 0);

  // G. ai_usage logging failure must not lose the analysis
  reset(); inserts = []; supabaseStatus = 500; console.error = () => {};
  r = await processMatchAnalysis(fake(baseData(), inserts), "t1");
  console.error = origError;
  check("G: usage-log failure still returns the stored analysis", r.ok === true && inserts.some(i => i.table === "cv_analyses"), r);

  // H. DB insert failure
  reset(); inserts = []; console.error = () => {};
  r = await processMatchAnalysis(fake(baseData(), inserts, "insert exploded: relation secret_table"), "t1");
  console.error = origError;
  check("H: insert failure -> ok:false with safe message", r.ok === false && !/secret_table|exploded/.test(r.error), r);

  // I. no JD -> title_only basis stored
  reset(); inserts = [];
  const dI = baseData(); dI.job_descriptions = null;
  r = await processMatchAnalysis(fake(dI, inserts), "t1");
  check("I: no JD -> basis title_only stored", inserts.find(i => i.table === "cv_analyses")?.row?.basis === "title_only");

  console.log(failures === 0 ? "\nALL PIPELINE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
