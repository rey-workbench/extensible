import type { UserScriptRecord } from "../types/user-scripts.types";

export function sanitizeRecord(s: UserScriptRecord): UserScriptRecord {
  const meta = s.meta || ({} as UserScriptRecord["meta"]);
  return {
    ...s,
    meta: {
      ...meta,
      matches: Array.isArray(meta.matches)
        ? meta.matches
        : typeof meta.matches === "string" && meta.matches
          ? [meta.matches]
          : ["*://*/*"],
      excludes: Array.isArray(meta.excludes) ? meta.excludes : [],
      grants: Array.isArray(meta.grants) && meta.grants.length ? meta.grants : ["none"],
    },
  };
}
