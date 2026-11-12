import { describe, expect, it } from "vitest";
import { buildMatcher } from "../src/match.js";

const m = buildMatcher(["QA", "Test*", "Quality"]);

describe("matcher", () => {
  it("matches whole words case-insensitively", () => {
    expect(m("Senior QA Engineer")).toBe(true);
    expect(m("qa analyst")).toBe(true);
    expect(m("Quality Assurance Lead")).toBe(true);
  });
  it("does not match keywords inside other words", () => {
    expect(m("Aqaba Manager")).toBe(false);
    expect(m("Equality Officer")).toBe(false);
  });
  it("matches Test as a prefix", () => {
    expect(m("Test Engineer")).toBe(true);
    expect(m("Software Tester")).toBe(true);
    expect(m("Performance Testing Lead")).toBe(true);
  });
  it("does not match Test mid-word", () => {
    expect(m("Contestant Manager")).toBe(false);
  });
  it("handles punctuation boundaries", () => {
    expect(m("SDET/QA")).toBe(true);
    expect(m("QA-Automation")).toBe(true);
  });
  it("applies exclude", () => {
    const x = buildMatcher(["QA", "Test*"], ["Intern", "Manager"]);
    expect(x("QA Engineer")).toBe(true);
    expect(x("QA Intern")).toBe(false);
    expect(x("Test Manager")).toBe(false);
  });
  it("escapes regex characters", () => {
    expect(buildMatcher(["C++"])("C++ Developer")).toBe(true);
  });
});
