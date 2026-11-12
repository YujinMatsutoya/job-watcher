import { capgemini } from "./capgemini.js";
import type { Adapter } from "./types.js";
import { workday } from "./workday.js";

export const adapters: Record<string, Adapter> = { capgemini, workday };
