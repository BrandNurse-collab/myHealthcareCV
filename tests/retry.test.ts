import { completeWithRetry } from "@/lib/ai/retry";
import type { AIProvider, CompletionResult } from "@/lib/ai/provider";

let failures = 0;
const check = (l: string, c: boolean, x?: unknown) => { if (c) console.log("PASS", l); else { failures++; console.log("FAIL", l, x ?? ""); } };
const origError = console.error;

function fakeProvider(behaviors: Array<"ok" | Error>): { provider: AIProvider; callCount: () => number } {
  let calls = 0;
  const provider: AIProvider = {
    async complete(): Promise<CompletionResult> {
      const behavior = behaviors[calls];
      calls++;
      if (behavior instanceof Error) throw behavior;
      return { text: "ok", provider: "gemini", model: "m", inputTokens: 1, outputTokens: 1 };
    },
  };
  return { provider, callCount: () => calls };
}

(async () => {
  {
    const { provider, callCount } = fakeProvider(["ok"]);
    const start = Date.now();
    const r = await completeWithRetry(provider, { prompt: "x" });
    check("immediate success: one call, no delay", callCount() === 1 && Date.now() - start < 200, { calls: callCount(), ms: Date.now() - start });
    check("returns the successful result", r.text === "ok");
  }

  {
    console.error = () => {};
    const { provider, callCount } = fakeProvider([new Error("Gemini API error 503: {...}"), "ok"]);
    const r = await completeWithRetry(provider, { prompt: "x" });
    console.error = origError;
    check("retries once on 503 and then succeeds", callCount() === 2 && r.text === "ok", callCount());
  }

  {
    console.error = () => {};
    const { provider, callCount } = fakeProvider([
      new Error("Gemini API error 500: oops"),
      new Error("Gemini API error 503: still down"),
      "ok",
    ]);
    const r = await completeWithRetry(provider, { prompt: "x" }, 2);
    console.error = origError;
    check("exactly 3 attempts total (maxRetries=2), succeeds on the last", callCount() === 3 && r.text === "ok", callCount());
  }

  {
    console.error = () => {};
    const { provider, callCount } = fakeProvider([
      new Error("Gemini API error 503: first"),
      new Error("Gemini API error 503: second"),
      new Error("Gemini API error 503: third and final"),
    ]);
    let thrown: unknown;
    try { await completeWithRetry(provider, { prompt: "x" }, 2); } catch (e) { thrown = e; }
    console.error = origError;
    check("exhausted retries: exactly 3 attempts, no 4th", callCount() === 3, callCount());
    check("throws the LAST error after exhausting retries", String(thrown).includes("third and final"), String(thrown));
  }

  {
    const { provider, callCount } = fakeProvider([
      new Error("Gemini API error 400: bad request"),
      "ok",
    ]);
    const start = Date.now();
    let thrown: unknown;
    try { await completeWithRetry(provider, { prompt: "x" }); } catch (e) { thrown = e; }
    check("non-retryable 400 throws on first attempt, no retry", callCount() === 1, callCount());
    check("non-retryable failure has no delay", Date.now() - start < 200);
    check("throws the actual 400 error", String(thrown).includes("400"));
  }

  {
    const { provider, callCount } = fakeProvider([new Error("Missing required environment variable: AI_API_KEY")]);
    let thrown: unknown;
    try { await completeWithRetry(provider, { prompt: "x" }); } catch (e) { thrown = e; }
    check("config errors are not retried", callCount() === 1 && String(thrown).includes("AI_API_KEY"));
  }

  {
    console.error = () => {};
    const { provider, callCount } = fakeProvider([new Error("AI call did not return valid JSON."), "ok"]);
    const r = await completeWithRetry(provider, { prompt: "x" });
    console.error = origError;
    check("JSON parse failure is retried and can recover", callCount() === 2 && r.text === "ok");
  }

  for (const status of [429, 500, 502, 503, 504, 529]) {
    console.error = () => {};
    const { provider, callCount } = fakeProvider([new Error(`Anthropic API error ${status}: x`), "ok"]);
    const r = await completeWithRetry(provider, { prompt: "x" });
    console.error = origError;
    check(`status ${status} is retried`, callCount() === 2 && r.text === "ok");
  }

  {
    const { provider, callCount } = fakeProvider([new Error("Gemini API error 5030: made up status"), "ok"]);
    let thrown: unknown;
    try { await completeWithRetry(provider, { prompt: "x" }); } catch (e) { thrown = e; }
    check("'5030' doesn't falsely match the '503' pattern (word boundary works)", callCount() === 1 && !!thrown, callCount());
  }

  {
    console.error = () => {};
    const { provider } = fakeProvider([
      new Error("Gemini API error 503: a"),
      new Error("Gemini API error 503: b"),
      "ok",
    ]);
    const start = Date.now();
    await completeWithRetry(provider, { prompt: "x" }, 2);
    const elapsed = Date.now() - start;
    console.error = origError;
    check("total backoff is roughly 1s+2s=3s (allowing jitter)", elapsed >= 2800 && elapsed <= 4000, elapsed);
  }

  console.log(failures === 0 ? "\nALL RETRY CHECKS PASSED" : `\n${failures} FAILED`);
  process.exit(failures ? 1 : 0);
})();
