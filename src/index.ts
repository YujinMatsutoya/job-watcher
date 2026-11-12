import { loadConfig } from "./config.js";
import { fetchJson } from "./http.js";
import { run } from "./run.js";
import { adapters } from "./sites/index.js";
import { loadState } from "./state.js";

const dryRun = process.argv.includes("--dry-run");

const { state, rules: previousRules } = loadState();
const outcome = await run({
  config: loadConfig(),
  state,
  previousRules,
  adapters,
  ctx: { fetchJson, delayMs: 1000 },
  now: new Date().toISOString(),
  dryRun,
  summaryPath: process.env.GITHUB_STEP_SUMMARY,
  log: (m) => console.log(m),
});

console.log("\n" + outcome.report);
if (dryRun) console.log("(dry-run: state and data/latest.md not written)");
process.exit(outcome.failed ? 1 : 0);
