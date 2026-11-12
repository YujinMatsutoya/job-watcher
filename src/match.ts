const WORD = "[\\p{L}\\p{N}]";

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "QA" -> whole word; "Test*" -> prefix (matches Tester, Testing). */
export function patternToRegex(pattern: string): RegExp {
  const p = pattern.trim();
  const prefix = p.endsWith("*");
  const term = escape(prefix ? p.slice(0, -1) : p);
  const tail = prefix ? "" : `(?!${WORD})`;
  return new RegExp(`(?<!${WORD})${term}${tail}`, "iu");
}

export type Matcher = (title: string) => boolean;

export function buildMatcher(keywords: string[], exclude: string[] = []): Matcher {
  const inc = keywords.map(patternToRegex);
  const exc = exclude.map(patternToRegex);
  return (title) => inc.some((r) => r.test(title)) && !exc.some((r) => r.test(title));
}
