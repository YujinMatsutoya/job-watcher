import { sleep } from "../http.js";
import type { Job } from "../types.js";
import { requireString, type Adapter } from "./types.js";

const PAGE_SIZE = 20; // Workday rejects larger limits with HTTP 400
const MAX_PAGES = 50;

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  bulletFields?: string[];
}
interface WorkdayPage {
  total?: number;
  jobPostings?: WorkdayPosting[];
}

export function parseWorkdayPage(page: unknown, baseUrl: string): Job[] {
  const postings = (page as WorkdayPage)?.jobPostings;
  if (!Array.isArray(postings)) throw new Error("unexpected Workday response (no jobPostings array)");
  return postings.flatMap((p) => {
    if (!p.title || !p.externalPath) return [];
    return [
      {
        id: p.bulletFields?.[0] || p.externalPath,
        title: p.title,
        location: p.locationsText ?? "",
        url: baseUrl + p.externalPath,
      },
    ];
  });
}

/**
 * Fetches ALL postings (empty searchText) and leaves keyword filtering to the
 * caller: Workday's search also matches descriptions. `total` is only returned
 * on the first page, so it is remembered from offset 0.
 */
export const workday: Adapter = async (site, ctx) => {
  // Tolerate a pasted URL: keep only the hostname.
  const host = requireString(site, "host").replace(/^https?:\/\//, "").split("/")[0]!;
  const tenant = requireString(site, "tenant");
  const siteName = requireString(site, "site");
  const endpoint = `https://${host}/wday/cxs/${tenant}/${siteName}/jobs`;
  const baseUrl = `https://${host}/en-US/${siteName}`;
  const appliedFacets = (site.appliedFacets as object | undefined) ?? {};

  const jobs: Job[] = [];
  let total: number | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    if (page > 0) await sleep(ctx.delayMs);
    const res = await ctx.fetchJson(endpoint, {
      method: "POST",
      body: { appliedFacets, limit: PAGE_SIZE, offset, searchText: "" },
    });
    if (page === 0) total = (res as WorkdayPage).total;
    const batch = parseWorkdayPage(res, baseUrl);
    jobs.push(...batch);
    const rawCount = (res as WorkdayPage).jobPostings?.length ?? 0;
    if (rawCount < PAGE_SIZE || (total !== undefined && offset + PAGE_SIZE >= total)) break;
  }
  return jobs;
};
