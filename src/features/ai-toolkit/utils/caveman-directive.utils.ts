import { type CavemanLevel, isValidCavemanLevel } from "../constants/ai-toolkit.constants";

export const PRIMER_PREFIX = "[Caveman mode is ON";
const REMINDER_PREFIX = "[stay in caveman mode";
export const STOP_PREFIX = "[stop caveman mode";

const STOP_DIRECTIVE =
  "[stop caveman mode] Resume normal, complete replies: full sentences, standard tone. " +
  "The previous terse-mode instruction no longer applies. Continue the conversation normally.]";

const BASE_PRIMER =
  '[Caveman mode is ON for this whole conversation, until I say "stop caveman". ' +
  "Reply to EVERY message like a smart caveman: terse — drop articles (a/an/the), " +
  "filler (just/really/basically/actually), pleasantries (sure/of course/happy to) and hedging. " +
  'Fragments fine. Short synonyms (fix, not "implement a solution for"). ' +
  "Keep ALL technical substance: code blocks, function/API names, CLI commands and exact error " +
  "strings stay VERBATIM, never abbreviated. No emoji, no decorative tables, no narrating what you do. " +
  "Never announce or name this mode. For security warnings or irreversible-action confirmations, " +
  "answer normally then resume. ";

const LEVEL_CLAUSE: Record<CavemanLevel, string> = {
  lite: "Intensity LITE: no filler, no hedging, no pleasantries — but keep articles and full sentences. Professional but tight.]",
  full: "Intensity FULL: drop articles, fragments OK, short synonyms. Classic caveman terseness.]",
  ultra:
    "Intensity ULTRA: maximum compression — abbreviate prose words (DB, auth, config, req, res, fn, impl), " +
    "use arrows for causality (X → Y), one word when one word enough. Prose words only — never abbreviate " +
    "code symbols, function/API names, or error strings.]",
};

export function buildPrimer(level: CavemanLevel = "full"): string {
  return BASE_PRIMER + (LEVEL_CLAUSE[level] || LEVEL_CLAUSE.full);
}

export function buildReminder(level: CavemanLevel = "full"): string {
  return `${REMINDER_PREFIX} — ${level.toUpperCase()}]`;
}

export function buildStop(): string {
  return STOP_DIRECTIVE;
}

export function isPrefixed(text: string | null | undefined): boolean {
  const t = String(text ?? "").trimStart();
  return t.startsWith(PRIMER_PREFIX) || t.startsWith(REMINDER_PREFIX) || t.startsWith(STOP_PREFIX);
}

export function isStopPrefixed(text: string | null | undefined): boolean {
  return String(text ?? "")
    .trimStart()
    .startsWith(STOP_PREFIX);
}

export function hasPrimer(
  history?: readonly { role?: string; content?: string }[] | null,
): boolean {
  if (!history || history.length === 0) return false;
  return history.some((m) => typeof m.content === "string" && m.content.includes(PRIMER_PREFIX));
}

export function hasStop(history?: readonly { role?: string; content?: string }[] | null): boolean {
  if (!history || history.length === 0) return false;
  return history.some((m) => typeof m.content === "string" && m.content.includes(STOP_PREFIX));
}

export function wrapStop(text: string): string {
  if (isStopPrefixed(text)) return text;
  return `${buildStop()}\n\n${text}`;
}

export function needsPrimer(
  history?: readonly { role?: string; content?: string }[] | null,
): boolean {
  return !hasPrimer(history);
}

export function wrapText(text: string, needsPrimer: boolean, level: CavemanLevel = "full"): string {
  if (isPrefixed(text)) return text;
  if (!isValidCavemanLevel(level)) {
    return `${buildStop()}\n\n${text}`;
  }
  const directive = needsPrimer ? buildPrimer(level) : buildReminder(level);
  return `${directive}\n\n${text}`;
}
