import { USER_SCRIPTS_DEFAULT_META } from "../constants/user-scripts.constants";
import type { UserScriptMeta } from "../types/user-scripts.types";

const HEADER_OPEN = "// ==UserScript==";
const HEADER_CLOSE = "// ==/UserScript==";

function firstListed(block: string, key: string): string {
  const re = new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, "im");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

function allListed(block: string, key: string): string[] {
  const re = new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, "gim");
  const out: string[] = [];
  for (const m of block.matchAll(re)) out.push(m[1].trim());
  return out;
}

/**
 * Parses a `// ==UserScript==` metadata block into a UserScriptMeta.
 * Spec §2 — all standard keys, unknown keys ignored. Values may be wrapped
 * in quotes (e.g. @name "My Script").
 */
export function parseUserScriptHeader(code: string, fallbackDefaultName?: string): UserScriptMeta {
  const start = code.indexOf(HEADER_OPEN);
  const end = code.indexOf(HEADER_CLOSE, start >= 0 ? start : 0);
  const block = start >= 0 && end > start ? code.slice(start, end) : "";

  const unquote = (v: string): string => {
    const q = v.match(/^"(.*)"$/) || v.match(/^'(.*)'$/);
    return q ? q[1] : v;
  };

  const matches = allListed(block, "match").map(unquote);
  const runAtRaw = firstListed(block, "run-at").toLowerCase();
  const runAt: UserScriptMeta["runAt"] =
    runAtRaw === "document-start" || runAtRaw === "document-end" ? runAtRaw : "document-idle";
  const injectRaw = firstListed(block, "inject-into").toLowerCase();
  const resources: Record<string, string> = {};
  // @resource <name> <url>
  const resourceRe = /^\s*\/\/\s*@resource\s+(\S+)\s+(.+?)\s*$/gim;
  for (const rm of block.matchAll(resourceRe)) resources[rm[1]] = unquote(rm[2]);

  const fallbackName =
    code
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.trim()
      .slice(0, 40) || "Untitled script";

  return {
    name: unquote(firstListed(block, "name")) || fallbackDefaultName || fallbackName,
    namespace: firstListed(block, "namespace"),
    version: firstListed(block, "version") || "0.0.0",
    description: unquote(firstListed(block, "description")),
    matches: matches.length ? matches : USER_SCRIPTS_DEFAULT_META.matches,
    excludes: allListed(block, "exclude").map(unquote),
    runAt,
    grants: allListed(block, "grant").map(unquote),
    requires: allListed(block, "require").map(unquote),
    resources,
    injectInto: injectRaw === "page" ? "page" : "content",
    connects: allListed(block, "connect").map(unquote),
    updateURL: firstListed(block, "updateURL") || firstListed(block, "updateurl"),
    downloadURL: firstListed(block, "downloadURL") || firstListed(block, "downloadurl"),
    icon: firstListed(block, "icon64") || firstListed(block, "icon"),
  };
}
