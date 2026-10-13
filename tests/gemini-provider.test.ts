import { GeminiProvider } from "@/lib/ai/providers/gemini";

process.env.AI_API_KEY = "test-gemini-key";
process.env.AI_MODEL = "gemini-test-model";

let lastUrl = "";
let lastInit: any = null;
function mockReply(body: unknown, status = 200) {
  globalThis.fetch = (async (url: any, init: any) => {
    lastUrl = String(url);
    lastInit = init;
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

let failures = 0;
const check = (l: string, c: boolean, x?: unknown) => { if (c) console.log("PASS", l); else { failures++; console.log("FAIL", l, x ?? ""); } };

(async () => {
  const provider = new GeminiProvider();

  // 1. Happy path
  mockReply({
    candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40 },
  });
  const r = await provider.complete({ system: "be terse", prompt: "hello", jsonMode: true, model: "gemini-test-model" });
  check("text extracted from candidates[0].content.parts", r.text === '{"ok":true}', r.text);
  check("provider tagged gemini", r.provider === "gemini");
  check("token usage mapped from usageMetadata", r.inputTokens === 120 && r.outputTokens === 40);
  check("endpoint uses :generateContent with the model name", lastUrl.includes("/models/gemini-test-model:generateContent"), lastUrl);
  check("key sent via x-goog-api-key header, not in the URL", lastInit.headers["x-goog-api-key"] === "test-gemini-key" && !lastUrl.includes("test-gemini-key"));
  const body = JSON.parse(lastInit.body);
  check("prompt goes in contents[0].parts[0].text", body.contents[0].parts[0].text === "hello");
  check("system prompt goes in systemInstruction, not contents", body.systemInstruction.parts[0].text === "be terse");
  check("jsonMode sets responseMimeType", body.generationConfig.responseMimeType === "application/json");

  // 2. jsonMode false -> no responseMimeType forced
  mockReply({ candidates: [{ content: { parts: [{ text: "plain text" }] } }], usageMetadata: {} });
  await provider.complete({ prompt: "hi", model: "m" });
  const body2 = JSON.parse(lastInit.body);
  check("no responseMimeType when jsonMode is false/unset", body2.generationConfig.responseMimeType === undefined);
  check("no systemInstruction key when no system prompt given", !("systemInstruction" in body2));

  // 3. Multiple text parts get concatenated
  mockReply({ candidates: [{ content: { parts: [{ text: "foo" }, { text: "bar" }] } }], usageMetadata: {} });
  const r3 = await provider.complete({ prompt: "x", model: "m" });
  check("multiple parts concatenated", r3.text === "foobar", r3.text);

  // 4. Safety block returns 200 with no real candidate — must throw, not silently return ""
  mockReply({ promptFeedback: { blockReason: "SAFETY" }, candidates: [] });
  let threw = false;
  try { await provider.complete({ prompt: "x", model: "m" }); } catch (e) { threw = true; check("block reason surfaced in error", String(e).includes("SAFETY")); }
  check("safety-blocked response throws rather than returning empty text", threw);

  // 5. HTTP error throws with status+body, not swallowed
  mockReply({ error: { message: "quota exceeded for today" } }, 429);
  threw = false;
  try { await provider.complete({ prompt: "x", model: "m" }); } catch (e) { threw = true; check("HTTP error message surfaced", String(e).includes("429") && String(e).includes("quota exceeded")); }
  check("non-2xx throws", threw);

  // 6. Missing candidates entirely (not even blocked) -> empty text, not a crash
  mockReply({ usageMetadata: {} });
  const r6 = await provider.complete({ prompt: "x", model: "m" });
  check("no candidates at all degrades to empty string, doesn't throw", r6.text === "");

  console.log(failures === 0 ? "\nALL GEMINI PROVIDER CHECKS PASSED" : `\n${failures} FAILED`);
  process.exit(failures ? 1 : 0);
})();
