import type { Job } from "./types.js";

export interface SiteResult {
  siteId: string;
  status: "ok" | "failed";
  initial?: boolean;
  newMatches?: Job[];
  error?: string;
}

const esc = (s: string) => s.replace(/[|\\[\]]/g, "\\$&").replace(/\s+/g, " ").trim();

export function renderReport(results: SiteResult[], date: string): string {
  const out: string[] = [`# Job watcher report - ${date}`, ""];
  const failed = results.filter((r) => r.status === "failed");
  const total = results.reduce((n, r) => n + (r.newMatches?.length ?? 0), 0);

  if (failed.length) {
    out.push(`**FAILED sites: ${failed.map((r) => r.siteId).join(", ")}** - results below are incomplete.`, "");
  }
  if (total === 0 && failed.length === 0) out.push("No new matching roles.", "");

  for (const r of results) {
    out.push(`## ${r.siteId}`, "");
    if (r.status === "failed") {
      out.push(`FAILED: ${r.error ?? "unknown error"}`, "");
      continue;
    }
    const jobs = r.newMatches ?? [];
    if (jobs.length === 0) {
      out.push("No new matches.", "");
      continue;
    }
    out.push(r.initial ? `Initial matches (${jobs.length}):` : `${jobs.length} new:`, "");
    out.push("| Title | Location |", "| --- | --- |");
    for (const j of jobs) out.push(`| [${esc(j.title)}](${j.url}) | ${esc(j.location)} |`);
    out.push("");
  }
  return out.join("\n");
}

export function hasFailure(results: SiteResult[]): boolean {
  return results.some((r) => r.status === "failed");
}
