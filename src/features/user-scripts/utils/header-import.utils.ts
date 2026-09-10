import type { UserScriptMeta } from "../types/user-scripts.types";

function grab(code: string, key: string): string {
  const m = code.match(new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, "im"));
  return m ? m[1].trim() : "";
}

function all(code: string, key: string): string[] {
  const re = new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, "gim");
  const out: string[] = [];
  for (const m of code.matchAll(re)) out.push(m[1].trim());
  return out;
}

/** Parses an imported file's header without importing the background parser. */
export function parseImportedHeader(
  code: string,
  fallbackName = "Imported script"
): UserScriptMeta {
  return {
    name: grab(code, "name") || fallbackName,
    namespace: grab(code, "namespace"),
    version: grab(code, "version") || "0.0.0",
    description: grab(code, "description"),
    matches: all(code, "match").length ? all(code, "match") : ["*://*/*"],
    excludes: all(code, "exclude"),
    runAt: (grab(code, "run-at") as UserScriptMeta["runAt"]) || "document-idle",
    grants: all(code, "grant"),
    requires: all(code, "require"),
    resources: {},
    injectInto: grab(code, "inject-into") === "page" ? "page" : "content",
    connects: all(code, "connect"),
    updateURL: grab(code, "updateURL"),
    downloadURL: grab(code, "downloadURL"),
    icon: grab(code, "icon64") || grab(code, "icon"),
  };
}
