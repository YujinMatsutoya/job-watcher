import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Job, Rules, State } from "./types.js";
import type { Matcher } from "./match.js";

export interface SiteDiff {
  /** Matching jobs not seen before (or all current matches on first run). */
  newMatches: Job[];
  /** True when the site had no prior state. */
  initial: boolean;
  /** Ids seen previously but absent from this run (informational). */
  removed: string[];
  /** True when some already-seen jobs are reported because the keywords changed. */
  updated: boolean;
}

export interface DiffOptions {
  /** Matcher built from the rules the state was last evaluated with. */
  wasMatch?: Matcher;
  /** Rules unknown (old state file): report every current match once. */
  forceInitial?: boolean;
}

/** seen.json = { _meta: { keywords, exclude }, <siteId>: { <jobId>: SeenJob } } */
export function loadState(path = "data/seen.json"): { state: State; rules?: Rules } {
  if (!existsSync(path)) return { state: {} };
  const { _meta, ...state } = JSON.parse(readFileSync(path, "utf8")) as State & { _meta?: Rules };
  return { state: state as State, rules: _meta };
}

export function saveState(state: State, path = "data/seen.json", rules?: Rules): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rules ? { _meta: rules, ...state } : state, null, 2) + "\n");
}

/**
 * Diff one site's current jobs against state. Returns the diff and the next
 * state for that site. Every job seen this run is recorded (not just matches);
 * jobs that disappear are retained so they never re-alert if they come back.
 */
export function diffSite(
  prev: State,
  siteId: string,
  jobs: Job[],
  isMatch: Matcher,
  now: string,
  opts: DiffOptions = {},
): { diff: SiteDiff; next: State } {
  const before = prev[siteId];
  const initial = before === undefined || opts.forceInitial === true;
  const known = before ?? {};

  // New = matches now and either never seen, or seen but did not match under the
  // previous rules (i.e. a keyword was added / an exclude removed since).
  const isNew = (j: Job) =>
    initial || !(j.id in known) || (opts.wasMatch !== undefined && !opts.wasMatch(j.title));
  const newMatches = jobs.filter((j) => isMatch(j.title) && isNew(j));
  const updated = !initial && newMatches.some((j) => j.id in known);

  const site = { ...known };
  const current = new Set<string>();
  for (const j of jobs) {
    current.add(j.id);
    if (!(j.id in site)) site[j.id] = { title: j.title, url: j.url, firstSeen: now };
  }
  const removed = Object.keys(known).filter((id) => !current.has(id));

  return { diff: { newMatches, initial, removed, updated }, next: { ...prev, [siteId]: site } };
}
