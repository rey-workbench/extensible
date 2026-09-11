import { type CavemanLevel, isValidCavemanLevel } from "../constants/ai-toolkit.constants";

export class CavemanDirectiveUtils {
  static readonly PRIMER_PREFIX = "[Caveman mode is ON";
  static readonly REMINDER_PREFIX = "[stay in caveman mode";
  static readonly STOP_PREFIX = "[stop caveman mode";

  private static readonly STOP_DIRECTIVE =
    "[stop caveman mode] Resume normal, complete replies: full sentences, standard tone. " +
    "The previous terse-mode instruction no longer applies. Continue the conversation normally.]";

  private static readonly BASE_PRIMER =
    '[Caveman mode is ON for this whole conversation, until I say "stop caveman". ' +
    "Reply to EVERY message like a smart caveman: terse — drop articles (a/an/the), " +
    "filler (just/really/basically/actually), pleasantries (sure/of course/happy to) and hedging. " +
    'Fragments fine. Short synonyms (fix, not "implement a solution for"). ' +
    "Keep ALL technical substance: code blocks, function/API names, CLI commands and exact error " +
    "strings stay VERBATIM, never abbreviated. No emoji, no decorative tables, no narrating what you do. " +
    "Never announce or name this mode. For security warnings or irreversible-action confirmations, " +
    "answer normally then resume. ";

  private static readonly LEVEL_CLAUSE: Record<CavemanLevel, string> = {
    lite: "Intensity LITE: no filler, no hedging, no pleasantries — but keep articles and full sentences. Professional but tight.]",
    full: "Intensity FULL: drop articles, fragments OK, short synonyms. Classic caveman terseness.]",
    ultra:
      "Intensity ULTRA: maximum compression — abbreviate prose words (DB, auth, config, req, res, fn, impl), " +
      "use arrows for causality (X → Y), one word when one word enough. Prose words only — never abbreviate " +
      "code symbols, function/API names, or error strings.]",
  };

  public static buildPrimer(level: CavemanLevel = "full"): string {
    return this.BASE_PRIMER + (this.LEVEL_CLAUSE[level] || this.LEVEL_CLAUSE.full);
  }

  public static buildReminder(level: CavemanLevel = "full"): string {
    return `${this.REMINDER_PREFIX} — ${level.toUpperCase()}]`;
  }

  public static buildStop(): string {
    return this.STOP_DIRECTIVE;
  }

  public static isPrefixed(text: string | null | undefined): boolean {
    const t = String(text ?? "").trimStart();
    return (
      t.startsWith(CavemanDirectiveUtils.PRIMER_PREFIX) ||
      t.startsWith(CavemanDirectiveUtils.REMINDER_PREFIX) ||
      t.startsWith(CavemanDirectiveUtils.STOP_PREFIX)
    );
  }

  public static isStopPrefixed(text: string | null | undefined): boolean {
    return String(text ?? "")
      .trimStart()
      .startsWith(this.STOP_PREFIX);
  }

  public static hasPrimer(
    history?: readonly { role?: string; content?: string }[] | null
  ): boolean {
    if (!history || history.length === 0) return false;
    return history.some(
      (m) => typeof m.content === "string" && m.content.includes(this.PRIMER_PREFIX)
    );
  }

  public static hasStop(history?: readonly { role?: string; content?: string }[] | null): boolean {
    if (!history || history.length === 0) return false;
    return history.some(
      (m) => typeof m.content === "string" && m.content.includes(this.STOP_PREFIX)
    );
  }

  public static wrapStop(text: string): string {
    if (this.isStopPrefixed(text)) return text;
    return `${this.buildStop()}\n\n${text}`;
  }

  public static needsPrimer(
    history?: readonly { role?: string; content?: string }[] | null
  ): boolean {
    return !this.hasPrimer(history);
  }

  public static wrapText(text: string, needsPrimer: boolean, level: CavemanLevel = "full"): string {
    if (CavemanDirectiveUtils.isPrefixed(text)) return text;
    if (!isValidCavemanLevel(level)) {
      return `${CavemanDirectiveUtils.buildStop()}\n\n${text}`;
    }
    const directive = needsPrimer
      ? CavemanDirectiveUtils.buildPrimer(level)
      : CavemanDirectiveUtils.buildReminder(level);
    return `${directive}\n\n${text}`;
  }
}
