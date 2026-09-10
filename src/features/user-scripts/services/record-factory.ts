import type { UserScriptRecord } from "../types/user-scripts.types";
import { parseUserScriptHeader } from "../utils/header-parser.utils";

/** Builds a fresh record by parsing code (used by install-from-URL and import). */
export function recordFromCode(code: string): UserScriptRecord {
  const now = Date.now();
  const meta = parseUserScriptHeader(code);
  return {
    id: `us_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    code,
    meta,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
  };
}
