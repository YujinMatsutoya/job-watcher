export interface Job {
  /** Stable per-site id (site job id / requisition number, else URL). */
  id: string;
  title: string;
  location: string;
  url: string;
}

export interface SiteConfig {
  id: string;
  adapter: string;
  [key: string]: unknown;
}

export interface Config {
  /** Case-insensitive title patterns. "QA" = whole word, "Test*" = prefix. */
  keywords: string[];
  exclude: string[];
  sites: SiteConfig[];
}

export interface SeenJob {
  title: string;
  url: string;
  firstSeen: string;
}

/** { siteId: { jobId: SeenJob } } */
export type State = Record<string, Record<string, SeenJob>>;
