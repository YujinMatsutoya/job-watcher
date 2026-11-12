import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Job, State } from "./types.js";
import type { Matcher } from "./match.js";

export interface SiteDiff {
  /** Matching jobs not seen before (or all current matches on first run). */
  newMatches: Job[];
  /** True when the site had no prior state. */
  initial: boolean;
  /** Ids seen previously but absent from this run (informational). */
  removed: string[];
}

export function loadState(path = "data/seen.json"): State {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as State;
}

export function saveState(state: State, path = "data/seen.json"): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
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
): { diff: SiteDiff; next: State } {
  const before = prev[siteId];
  const initial = before === undefined;
  const known = before ?? {};

  const newMatches = jobs.filter((j) => isMatch(j.title) && (initial || !(j.id in known)));

  const site = { ...known };
  const current = new Set<string>();
  for (const j of jobs) {
    current.add(j.id);
    if (!(j.id in site)) site[j.id] = { title: j.title, url: j.url, firstSeen: now };
  }
  const removed = Object.keys(known).filter((id) => !current.has(id));

  return { diff: { newMatches, initial, removed }, next: { ...prev, [siteId]: site } };
}
