import { sleep } from "../http.js";
import type { Job } from "../types.js";
import { requireString, type Adapter } from "./types.js";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const DEFAULT_API = "https://cg-jobstream-api.azurewebsites.net/api";

interface CapgeminiRow {
  id?: string;
  title?: string;
  location?: string;
  apply_job_url?: string;
}
interface CapgeminiPage {
  total?: number;
  data?: CapgeminiRow[];
}

export function parseCapgeminiPage(page: unknown): Job[] {
  const data = (page as CapgeminiPage)?.data;
  if (!Array.isArray(data)) throw new Error("unexpected Capgemini response (no data array)");
  return data.flatMap((r) =>
    r.id && r.title
      ? [{ id: r.id, title: r.title, location: r.location ?? "", url: r.apply_job_url ?? "" }]
      : [],
  );
}

/**
 * Uses the JSON API behind the careers page (GET /job-search). Fetches ALL jobs
 * for the country and leaves keyword filtering to the caller, because the API's
 * `search` also matches descriptions. Optional `locations` (array of strings)
 * keeps only jobs whose location text contains one of them (case-insensitive).
 */
export const capgemini: Adapter = async (site, ctx) => {
  const api = typeof site.api === "string" ? site.api : DEFAULT_API;
  const country = requireString(site, "country_code");
  const locations = Array.isArray(site.locations) ? (site.locations as string[]).map((l) => l.toLowerCase()) : [];

  const jobs: Job[] = [];
  let seenRows = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(ctx.delayMs);
    const res = await ctx.fetchJson(`${api}/job-search?page=${page}&size=${PAGE_SIZE}&country_code=${encodeURIComponent(country)}`);
    const batch = parseCapgeminiPage(res);
    const rawCount = (res as CapgeminiPage).data?.length ?? 0;
    seenRows += rawCount;
    jobs.push(...batch);
    const total = (res as CapgeminiPage).total;
    if (rawCount === 0 || rawCount < PAGE_SIZE || (total !== undefined && seenRows >= total)) break;
  }
  return locations.length ? jobs.filter((j) => locations.some((l) => j.location.toLowerCase().includes(l))) : jobs;
};
