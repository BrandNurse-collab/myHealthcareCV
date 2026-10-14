import { parseJsonCompletion } from "@/lib/ai/json";

let failures = 0;
const check = (l: string, c: boolean, x?: unknown) => { if (c) console.log("PASS", l); else { failures++; console.log("FAIL", l, x ?? ""); } };
const origError = console.error;

// 1. Clean JSON — unaffected by the new fallback logic
check("clean JSON still parses directly", (parseJsonCompletion('{"a":1}') as any).a === 1);

// 2. Fenced JSON — unaffected
check("fenced JSON still parses", (parseJsonCompletion('```json\n{"a":2}\n```') as any).a === 2);

// 3. JSON wrapped in a stray sentence — the new fallback should salvage this
check(
  "JSON wrapped in prose is salvaged",
  (parseJsonCompletion('Sure, here is the result:\n{"a":3}\nHope that helps!') as any).a === 3
);

// 4. Truncated mid-structure (the real-world Gemini case this was built
// for) — an unterminated string/object. This should NOT be salvageable,
// and must fail loudly rather than return a half-built, silently-wrong object.
console.error = () => {};
let threw = false;
try {
  parseJsonCompletion('{"employmentHistory":[{"jobTitle":"Claims Officer","responsibilities":["Adjudicated clai');
} catch {
  threw = true;
}
console.error = origError;
check("genuinely truncated JSON still throws (not silently half-parsed)", threw);

// 5. Complete garbage, no braces at all
console.error = () => {};
threw = false;
try { parseJsonCompletion("I cannot process this request."); } catch { threw = true; }
console.error = origError;
check("non-JSON prose throws", threw);

// 6. A bare top-level array (nothing but "[...]", no braces at all) has no
// "{"..."}" substring for the fallback to find, so it's correctly rejected.
console.error = () => {};
threw = false;
try { parseJsonCompletion('["a", "b", "c"]'); } catch { threw = true; }
console.error = origError;
check("an array with no embedded object is rejected", threw);

// 6b. An array WRAPPING a single object, by contrast, legitimately has a
// "{"..."}" substring inside it — the same fallback that salvages
// prose-wrapped JSON reasonably salvages this too. Real content, not
// fabricated; documenting the behavior rather than fighting it.
check(
  "an array wrapping one object salvages that inner object (documented, not a bug)",
  (parseJsonCompletion('[{"a":1}]') as any).a === 1
);

// 7. Failure path logs diagnostic output rather than failing silently
let logged = "";
console.error = (...args: unknown[]) => { logged = args.join(" "); };
try { parseJsonCompletion("not json"); } catch { /* expected */ }
console.error = origError;
check("parse failure logs the raw text for diagnosis", logged.includes("not json"), logged);

// 8. A very long failing response gets truncated in the log, not dumped whole
console.error = () => {};
const huge = "x".repeat(5000);
try { parseJsonCompletion(huge); } catch { /* expected */ }
console.error = origError;
let loggedHuge = "";
console.error = (...args: unknown[]) => { loggedHuge = args.join(" "); };
try { parseJsonCompletion(huge); } catch { /* expected */ }
console.error = origError;
check("oversized failing output is truncated in the log, not dumped in full", loggedHuge.length < 2500, loggedHuge.length);

console.log(failures === 0 ? "\nALL JSON PARSER CHECKS PASSED" : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
