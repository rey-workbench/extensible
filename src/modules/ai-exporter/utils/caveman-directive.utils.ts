import { type CavemanLevel, isValidCavemanLevel } from "../constants/ai-exporter.constants";

export class CavemanDirectiveUtils {
  private static readonly PRIMER_PREFIX = "[Caveman mode is ON";
  private static readonly REMINDER_PREFIX = "[stay in caveman mode";
  private static readonly STOP_PREFIX = "[stop caveman mode";

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

  /**
   * Build full primer prompt for introducing caveman mode to the AI.
   */
  public static buildPrimer(level: CavemanLevel = "full"): string {
    return this.BASE_PRIMER + (this.LEVEL_CLAUSE[level] || this.LEVEL_CLAUSE.full);
  }

  /**
   * Build short reminder prompt for subsequent messages in an already primed conversation.
   */
  public static buildReminder(level: CavemanLevel = "full"): string {
    return `${this.REMINDER_PREFIX} — ${level.toUpperCase()}]`;
  }

  /**
   * Build the stop directive that cancels caveman mode in an ongoing conversation.
   * Used when the stored level is not a known enum value (stale/corrupted settings).
   */
  public static buildStop(): string {
    return this.STOP_DIRECTIVE;
  }

  /**
   * Checks if user input already starts with a caveman directive to avoid double injection.
   */
  public static isPrefixed(text: string | null | undefined): boolean {
    const t = String(text ?? "").trimStart();
    return (
      t.startsWith(this.PRIMER_PREFIX) ||
      t.startsWith(this.REMINDER_PREFIX) ||
      t.startsWith(this.STOP_PREFIX)
    );
  }

  /**
   * Checks if the input already starts with the stop directive (avoids re-injecting it).
   */
  public static isStopPrefixed(text: string | null | undefined): boolean {
    return String(text ?? "")
      .trimStart()
      .startsWith(this.STOP_PREFIX);
  }

  /**
   * Checks if the chat history already contains the Caveman mode primer.
   */
  public static hasPrimer(
    history?: readonly { role?: string; content?: string }[] | null
  ): boolean {
    if (!history || history.length === 0) return false;
    return history.some(
      (m) => typeof m.content === "string" && m.content.includes(this.PRIMER_PREFIX)
    );
  }

  /**
   * Checks if the chat history already contains the stop directive (caveman cancelled).
   */
  public static hasStop(history?: readonly { role?: string; content?: string }[] | null): boolean {
    if (!history || history.length === 0) return false;
    return history.some(
      (m) => typeof m.content === "string" && m.content.includes(this.STOP_PREFIX)
    );
  }

  /**
   * Prepends the stop directive to the input (cancels caveman in an ongoing chat).
   */
  public static wrapStop(text: string): string {
    if (this.isStopPrefixed(text)) return text;
    return `${this.buildStop()}\n\n${text}`;
  }

  /**
   * Determines whether the full primer must be injected.
   * Returns true if history is empty OR if no previous message in the conversation has the primer.
   */
  public static needsPrimer(
    history?: readonly { role?: string; content?: string }[] | null
  ): boolean {
    return !this.hasPrimer(history);
  }

  /**
   * Prepends either primer, reminder, or the stop directive to the input.
   * An unknown/invalid level forces the stop directive instead of silently resuming terse mode.
   */
  public static wrapText(text: string, needsPrimer: boolean, level: CavemanLevel = "full"): string {
    if (this.isPrefixed(text)) return text;
    if (!isValidCavemanLevel(level)) {
      return `${this.buildStop()}\n\n${text}`;
    }
    const directive = needsPrimer ? this.buildPrimer(level) : this.buildReminder(level);
    return `${directive}\n\n${text}`;
  }
}
