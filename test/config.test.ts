import { describe, expect, it } from "vitest";
import { loadConfig, parseConfig } from "../src/config.js";

describe("config", () => {
  it("loads the repo config.json", () => {
    const c = loadConfig();
    expect(c.sites.map((s) => s.id)).toEqual(["capgemini-uk", "ticketmaster"]);
    expect(c.exclude).toEqual([]);
  });
  it("rejects empty keywords, missing sites and duplicate ids", () => {
    expect(() => parseConfig({ keywords: [], sites: [{ id: "a", adapter: "x" }] })).toThrow();
    expect(() => parseConfig({ keywords: ["QA"], sites: [] })).toThrow();
    expect(() => parseConfig({ keywords: ["QA"], sites: [{ id: "a", adapter: "x" }, { id: "a", adapter: "x" }] })).toThrow();
  });
  it("defaults exclude to empty", () => {
    expect(parseConfig({ keywords: ["QA"], sites: [{ id: "a", adapter: "x" }] }).exclude).toEqual([]);
  });
});
