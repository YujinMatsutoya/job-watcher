import type { JsonFetcher } from "../http.js";
import type { Job, SiteConfig } from "../types.js";

export interface AdapterContext {
  fetchJson: JsonFetcher;
  /** Delay between paginated requests (ms). Tests pass 0. */
  delayMs: number;
}

export type Adapter = (site: SiteConfig, ctx: AdapterContext) => Promise<Job[]>;

export function requireString(site: SiteConfig, key: string): string {
  const v = site[key];
  if (typeof v !== "string" || !v) throw new Error(`site ${site.id}: missing config field "${key}"`);
  return v;
}
