import { describe, expect, it } from "vitest";
import { hasFailure, renderReport } from "../src/report.js";

const j = { id: "1", title: "QA Engineer", location: "London", url: "https://x/1" };

describe("report", () => {
  it("says no new matches in one line when everything is quiet", () => {
    const md = renderReport([{ siteId: "s", status: "ok", newMatches: [] }], "2026-11-12");
    expect(md).toContain("No new matching roles.");
  });
  it("lists matches with links, labelling initial runs", () => {
    const md = renderReport([{ siteId: "s", status: "ok", initial: true, newMatches: [j] }], "d");
    expect(md).toContain("Initial matches (1)");
    expect(md).toContain("[QA Engineer](https://x/1)");
  });
  it("never lets a failure read as 'no matches'", () => {
    const results = [{ siteId: "s", status: "failed" as const, error: "HTTP 500" }];
    const md = renderReport(results, "d");
    expect(md).toContain("FAILED sites: s");
    expect(md).not.toContain("No new matching roles.");
    expect(hasFailure(results)).toBe(true);
  });
});
