import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { capgemini } from "../src/sites/capgemini.js";
import { workday } from "../src/sites/workday.js";
import type { JsonFetcher } from "../src/http.js";

const fx = (name: string) => JSON.parse(readFileSync(`test/fixtures/${name}`, "utf8"));

describe("workday adapter", () => {
  const site = { id: "tm", adapter: "workday", host: "livenation.wd503.myworkdayjobs.com", tenant: "livenation", site: "TMExternalSite" };

  it("paginates by offset (total only on first page) and builds links", async () => {
    const offsets: number[] = [];
    const pages = [fx("workday-all-offset0.json"), fx("workday-all-offset20.json"), fx("workday-all-offset40.json")];
    const fetchJson: JsonFetcher = async (url, init) => {
      expect(url).toBe("https://livenation.wd503.myworkdayjobs.com/wday/cxs/livenation/TMExternalSite/jobs");
      const body = init?.body as { offset: number; limit: number; searchText: string };
      expect(body.limit).toBe(20);
      expect(body.searchText).toBe("");
      offsets.push(body.offset);
      return pages[body.offset / 20];
    };
    const jobs = await workday(site, { fetchJson, delayMs: 0 });
    expect(offsets).toEqual([0, 20, 40]);
    expect(jobs).toHaveLength(43);
    expect(jobs[0]).toEqual({
      id: "JR-94243",
      title: "HR Business Partner - APAC",
      location: "Melbourne, Australia",
      url: "https://livenation.wd503.myworkdayjobs.com/en-US/TMExternalSite/job/Melbourne-Australia/HR-Business-Partner---APAC_JR-94243-1",
    });
    expect(new Set(jobs.map((j) => j.id)).size).toBe(43);
  });

  it("throws on an unexpected response shape", async () => {
    await expect(workday(site, { fetchJson: async () => ({ oops: true }), delayMs: 0 })).rejects.toThrow(/jobPostings/);
  });

  it("accepts a pasted URL as host", async () => {
    let seen = "";
    const fetchJson: JsonFetcher = async (url) => { seen = url; return { total: 0, jobPostings: [] }; };
    await workday({ ...site, host: "https://livenation.wd503.myworkdayjobs.com/en-US/TMExternalSite" }, { fetchJson, delayMs: 0 });
    expect(seen).toBe("https://livenation.wd503.myworkdayjobs.com/wday/cxs/livenation/TMExternalSite/jobs");
  });

  it("requires host/tenant/site", async () => {
    await expect(workday({ id: "x", adapter: "workday" }, { fetchJson: async () => ({}), delayMs: 0 })).rejects.toThrow(/host/);
  });
});

describe("capgemini adapter", () => {
  const site = { id: "cg", adapter: "capgemini", country_code: "gb-en" };

  it("paginates until total is reached", async () => {
    const urls: string[] = [];
    const p1 = fx("capgemini-page1.json");
    const p2 = fx("capgemini-page2.json");
    const half = { total: 150, data: p2.data.slice(0, 50) };
    const fetchJson: JsonFetcher = async (url) => {
      urls.push(url);
      return url.includes("page=1&") ? { ...p1, total: 150 } : half;
    };
    const jobs = await capgemini(site, { fetchJson, delayMs: 0 });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe("https://cg-jobstream-api.azurewebsites.net/api/job-search?page=1&size=100&country_code=gb-en");
    expect(jobs).toHaveLength(150);
    expect(jobs[0]!.url).toMatch(/^https:\/\/careers\.capgemini\.com\//);
  });

  it("can filter by location text", async () => {
    const p1 = fx("capgemini-page1.json");
    const jobs = await capgemini({ ...site, locations: ["London"] }, { fetchJson: async () => ({ ...p1, total: 100 }), delayMs: 0 });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.length).toBeLessThan(100);
    expect(jobs.every((j) => j.location.toLowerCase().includes("london"))).toBe(true);
  });
});
