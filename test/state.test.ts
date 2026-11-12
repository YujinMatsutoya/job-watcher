import { describe, expect, it } from "vitest";
import { buildMatcher } from "../src/match.js";
import { diffSite } from "../src/state.js";
import type { Job, State } from "../src/types.js";

const isMatch = buildMatcher(["QA", "Test*"]);
const job = (id: string, title: string): Job => ({ id, title, location: "London", url: `https://x/${id}` });
const T1 = "2026-11-12T09:00:00Z";
const T2 = "2026-11-13T09:00:00Z";

describe("diffSite", () => {
  it("first run reports all current matches as initial and records every job", () => {
    const { diff, next } = diffSite({}, "s", [job("1", "QA Engineer"), job("2", "Chef")], isMatch, T1);
    expect(diff.initial).toBe(true);
    expect(diff.newMatches.map((j) => j.id)).toEqual(["1"]);
    expect(Object.keys(next.s!)).toEqual(["1", "2"]);
    expect(next.s!["1"]!.firstSeen).toBe(T1);
  });

  it("reports nothing on an unchanged second run", () => {
    const jobs = [job("1", "QA Engineer")];
    const first = diffSite({}, "s", jobs, isMatch, T1);
    const second = diffSite(first.next, "s", jobs, isMatch, T2);
    expect(second.diff.initial).toBe(false);
    expect(second.diff.newMatches).toEqual([]);
    expect(second.next.s!["1"]!.firstSeen).toBe(T1);
  });

  it("reports a new matching job but not a new non-matching one", () => {
    const first = diffSite({}, "s", [job("1", "QA Engineer")], isMatch, T1);
    const { diff } = diffSite(first.next, "s", [job("1", "QA Engineer"), job("2", "Test Lead"), job("3", "Chef")], isMatch, T2);
    expect(diff.newMatches.map((j) => j.id)).toEqual(["2"]);
  });

  it("lists removed jobs but retains them so they do not re-alert", () => {
    const first = diffSite({}, "s", [job("1", "QA Engineer")], isMatch, T1);
    const gone = diffSite(first.next, "s", [], isMatch, T2);
    expect(gone.diff.removed).toEqual(["1"]);
    const back = diffSite(gone.next, "s", [job("1", "QA Engineer")], isMatch, T2);
    expect(back.diff.newMatches).toEqual([]);
  });

  it("a seen non-matching job that later gains a matching title is not re-alerted", () => {
    const first = diffSite({}, "s", [job("1", "Engineer")], isMatch, T1);
    const { diff } = diffSite(first.next, "s", [job("1", "QA Engineer")], isMatch, T2);
    expect(diff.newMatches).toEqual([]);
  });

  it("treats a site absent from state as initial without touching others", () => {
    const prev: State = { other: { a: { title: "t", url: "u", firstSeen: T1 } } };
    const { diff, next } = diffSite(prev, "s", [job("1", "QA")], isMatch, T2);
    expect(diff.initial).toBe(true);
    expect(next.other).toEqual(prev.other);
  });
});

describe("diffSite with changed keywords", () => {
  const was = buildMatcher(["QA"]);
  const now = buildMatcher(["QA", "Client"]);

  it("reports already-seen jobs that only match under the new keywords, once", () => {
    const jobs = [job("1", "QA Engineer"), job("2", "Client Manager")];
    const first = diffSite({}, "s", jobs, was, T1);
    const { diff, next } = diffSite(first.next, "s", jobs, now, T2, { wasMatch: was });
    expect(diff.newMatches.map((j) => j.id)).toEqual(["2"]);
    expect(diff.updated).toBe(true);
    const again = diffSite(next, "s", jobs, now, T2, { wasMatch: now });
    expect(again.diff.newMatches).toEqual([]);
    expect(again.diff.updated).toBe(false);
  });

  it("does not alert when a keyword is removed", () => {
    const jobs = [job("1", "QA Engineer"), job("2", "Client Manager")];
    const first = diffSite({}, "s", jobs, now, T1);
    const { diff } = diffSite(first.next, "s", jobs, was, T2, { wasMatch: now });
    expect(diff.newMatches).toEqual([]);
  });

  it("forceInitial reports every current match (old state without rules)", () => {
    const jobs = [job("1", "QA Engineer"), job("2", "Client Manager")];
    const first = diffSite({}, "s", jobs, now, T1);
    const { diff } = diffSite(first.next, "s", jobs, now, T2, { forceInitial: true });
    expect(diff.initial).toBe(true);
    expect(diff.newMatches).toHaveLength(2);
  });
});
