import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadState } from "../src/state.js";
import { run } from "../src/run.js";
import type { Adapter } from "../src/sites/types.js";
import type { Config, Job } from "../src/types.js";

const job = (id: string, title: string): Job => ({ id, title, location: "UK", url: `https://x/${id}` });
const config: Config = {
  keywords: ["QA", "Test*"],
  exclude: [],
  sites: [{ id: "good", adapter: "good" }, { id: "bad", adapter: "bad" }],
};
const ctx = { fetchJson: async () => ({}), delayMs: 0 };
const base = (dir: string) => ({
  config, ctx, now: "2026-11-12T09:00:00Z", statePath: join(dir, "seen.json"), reportPath: join(dir, "latest.md"),
});

describe("run", () => {
  it("one failing site is FAILED but the other still reports; exit signal is failed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const adapters: Record<string, Adapter> = {
      good: async () => [job("1", "QA Engineer"), job("2", "Chef")],
      bad: async () => { throw new Error("HTTP 503"); },
    };
    const out = await run({ ...base(dir), state: {}, adapters, dryRun: false });
    expect(out.failed).toBe(true);
    expect(out.report).toContain("QA Engineer");
    expect(out.report).toContain("FAILED: HTTP 503");
    expect(out.state.bad).toBeUndefined();
    expect(JSON.parse(readFileSync(join(dir, "seen.json"), "utf8")).good["1"].title).toBe("QA Engineer");
  });

  it("second identical run reports no new matches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const adapters: Record<string, Adapter> = { good: async () => [job("1", "QA Engineer")], bad: async () => [job("9", "Tester")] };
    const first = await run({ ...base(dir), state: {}, adapters, dryRun: false });
    expect(first.report).toContain("Initial matches");
    const second = await run({ ...base(dir), state: first.state, previousRules: first.rules, adapters, dryRun: false });
    expect(second.failed).toBe(false);
    expect(second.report).toContain("No new matching roles.");
  });

  it("zero jobs after previously seeing some is a failure, not 'no matches'", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const state = { good: { "1": { title: "QA", url: "u", firstSeen: "t" } } };
    const adapters: Record<string, Adapter> = { good: async () => [], bad: async () => [] };
    const out = await run({ ...base(dir), state, adapters, dryRun: true });
    expect(out.failed).toBe(true);
    expect(out.report).toContain("returned 0 jobs");
  });

  it("unknown adapter fails the site", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const out = await run({ ...base(dir), state: {}, adapters: { good: async () => [] }, dryRun: true });
    expect(out.results.find((r) => r.siteId === "bad")).toMatchObject({ status: "failed", error: expect.stringContaining("unknown adapter") });
  });

  it("dry-run writes nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const adapters: Record<string, Adapter> = { good: async () => [job("1", "QA")], bad: async () => [] };
    await run({ ...base(dir), state: {}, adapters, dryRun: true });
    expect(existsSync(join(dir, "seen.json"))).toBe(false);
    expect(existsSync(join(dir, "latest.md"))).toBe(false);
  });

  it("adding a keyword reports existing matching jobs once, persisting the rules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const adapters: Record<string, Adapter> = {
      good: async () => [job("1", "QA Engineer"), job("2", "Client Manager")],
      bad: async () => [],
    };
    const oldCfg: Config = { ...config, keywords: ["QA"] };
    const first = await run({ ...base(dir), config: oldCfg, state: {}, adapters, dryRun: false });
    expect(first.failed).toBe(false);
    const loaded = loadState(join(dir, "seen.json"));
    expect(loaded.rules).toEqual({ keywords: ["QA"], exclude: [] });

    const newCfg: Config = { ...config, keywords: ["QA", "Client"] };
    const second = await run({ ...base(dir), config: newCfg, state: loaded.state, previousRules: loaded.rules, adapters, dryRun: false });
    expect(second.report).toContain("Client Manager");
    expect(second.report).not.toContain("[QA Engineer]");
    expect(second.report).toContain("updated keywords");

    const reloaded = loadState(join(dir, "seen.json"));
    const third = await run({ ...base(dir), config: newCfg, state: reloaded.state, previousRules: reloaded.rules, adapters, dryRun: false });
    expect(third.report).toContain("No new matching roles.");
  });

  it("a state file without rules reports all matches once, then settles", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const adapters: Record<string, Adapter> = { good: async () => [job("1", "QA Engineer")], bad: async () => [] };
    const legacy = { good: { "1": { title: "QA Engineer", url: "u", firstSeen: "t" } }, bad: {} };
    const a = await run({ ...base(dir), state: legacy, adapters, dryRun: false });
    expect(a.report).toContain("Initial matches");
    const l = loadState(join(dir, "seen.json"));
    const b = await run({ ...base(dir), state: l.state, previousRules: l.rules, adapters, dryRun: false });
    expect(b.report).toContain("No new matching roles.");
  });

  it("keeps the old rules when a site fails so nothing is lost", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jw-"));
    const prev = { keywords: ["QA"], exclude: [] };
    const adapters: Record<string, Adapter> = { good: async () => [job("1", "QA")], bad: async () => { throw new Error("x"); } };
    const out = await run({ ...base(dir), state: {}, previousRules: prev, adapters, dryRun: false });
    expect(out.rules).toEqual(prev);
  });
});
