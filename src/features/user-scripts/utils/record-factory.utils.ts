import { createUniqueId } from "@/lib/utils";
import type { UserScriptRecord } from "../types/user-scripts.types";
import { parseUserScriptHeader } from "./header-parser.utils";

export function newScriptCopy(src: UserScriptRecord): UserScriptRecord {
  const now = Date.now();
  return {
    ...src,
    id: createUniqueId("us"),
    meta: { ...src.meta, name: `${src.meta.name} (copy)` },
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
  };
}

export function recordFromCode(code: string): UserScriptRecord {
  const now = Date.now();
  const meta = parseUserScriptHeader(code);
  return {
    id: createUniqueId("us"),
    code,
    meta,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
  };
}
