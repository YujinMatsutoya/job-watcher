import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildMatcher } from "./match.js";
import { renderReport, type SiteResult } from "./report.js";
import { diffSite, saveState } from "./state.js";
import type { Adapter, AdapterContext } from "./sites/types.js";
import type { Config, State } from "./types.js";

export interface RunOptions {
  config: Config;
  state: State;
  adapters: Record<string, Adapter>;
  ctx: AdapterContext;
  now: string;
  dryRun: boolean;
  statePath?: string;
  reportPath?: string;
  summaryPath?: string;
  log?: (msg: string) => void;
}

export interface RunOutcome {
  results: SiteResult[];
  report: string;
  state: State;
  failed: boolean;
}

/** Runs every site independently; one site failing never hides the others. */
export async function run(opts: RunOptions): Promise<RunOutcome> {
  const { config, adapters, ctx, now, dryRun } = opts;
  const log = opts.log ?? (() => {});
  const isMatch = buildMatcher(config.keywords, config.exclude);
  let state = opts.state;
  const results: SiteResult[] = [];

  for (const site of config.sites) {
    try {
      const adapter = adapters[site.adapter];
      if (!adapter) throw new Error(`unknown adapter "${site.adapter}"`);
      const jobs = await adapter(site, ctx);
      const previouslySeen = Object.keys(state[site.id] ?? {}).length;
      if (jobs.length === 0 && previouslySeen > 0) {
        throw new Error(`returned 0 jobs but ${previouslySeen} were seen before (site changed or blocked us?)`);
      }
      const { diff, next } = diffSite(state, site.id, jobs, isMatch, now);
      state = next;
      results.push({ siteId: site.id, status: "ok", initial: diff.initial, newMatches: diff.newMatches });
      log(`${site.id}: ${jobs.length} jobs, ${diff.newMatches.length} new match(es)`);
    } catch (err) {
      const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : "";
      const error = (err instanceof Error ? err.message : String(err)) + cause;
      results.push({ siteId: site.id, status: "failed", error });
      log(`${site.id}: FAILED - ${error}`);
    }
  }

  const report = renderReport(results, now.slice(0, 10));
  if (!dryRun) {
    saveState(state, opts.statePath);
    const reportPath = opts.reportPath ?? "data/latest.md";
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, report + "\n");
  }
  if (opts.summaryPath) appendFileSync(opts.summaryPath, report + "\n");

  return { results, report, state, failed: results.some((r) => r.status === "failed") };
}
