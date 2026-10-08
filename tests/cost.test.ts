import { estimateCostUsd } from "@/lib/ai/cost";
let failures = 0;
const check = (l: string, c: boolean, x?: unknown) => { if (c) console.log("PASS", l); else { failures++; console.log("FAIL", l, x ?? ""); } };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

check("sonnet-5 input priced", near(estimateCostUsd("claude-sonnet-5", 1_000_000, 0), 2));
check("sonnet-5 output priced", near(estimateCostUsd("claude-sonnet-5", 0, 1_000_000), 10));
check("dated haiku snapshot is NOT priced at $0", near(estimateCostUsd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000), 6), estimateCostUsd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000));
check("sonnet-4-6 not confused with sonnet-5", near(estimateCostUsd("claude-sonnet-4-6", 1_000_000, 0), 3));
check("unknown model logs 0, doesn't throw", estimateCostUsd("mystery-model", 5000, 5000) === 0);
check("realistic match analysis (6k in / 2k out on sonnet-5) is a few cents", near(estimateCostUsd("claude-sonnet-5", 6000, 2000), 0.032));
console.log(failures === 0 ? "\nALL COST CHECKS PASSED" : `\n${failures} FAILED`); process.exit(failures ? 1 : 0);
