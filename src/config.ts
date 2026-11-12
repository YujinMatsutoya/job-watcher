import { readFileSync } from "node:fs";
import type { Config } from "./types.js";

export function parseConfig(raw: unknown): Config {
  if (typeof raw !== "object" || raw === null) throw new Error("config must be an object");
  const c = raw as Record<string, unknown>;
  const strList = (key: string): string[] => {
    const v = c[key] ?? [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x.trim())) {
      throw new Error(`config.${key} must be an array of non-empty strings`);
    }
    return v as string[];
  };
  const keywords = strList("keywords");
  if (keywords.length === 0) throw new Error("config.keywords must not be empty");
  const exclude = strList("exclude");

  if (!Array.isArray(c.sites) || c.sites.length === 0) throw new Error("config.sites must be a non-empty array");
  const seen = new Set<string>();
  for (const s of c.sites) {
    if (typeof s !== "object" || s === null) throw new Error("each site must be an object");
    const { id, adapter } = s as Record<string, unknown>;
    if (typeof id !== "string" || !id) throw new Error("each site needs a string id");
    if (typeof adapter !== "string" || !adapter) throw new Error(`site ${id} needs an adapter`);
    if (seen.has(id)) throw new Error(`duplicate site id: ${id}`);
    seen.add(id);
  }
  return { keywords, exclude, sites: c.sites as Config["sites"] };
}

export function loadConfig(path = "config.json"): Config {
  return parseConfig(JSON.parse(readFileSync(path, "utf8")));
}
