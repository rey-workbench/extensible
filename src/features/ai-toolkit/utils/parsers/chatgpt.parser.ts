import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";
import {
  classNamesOf,
  cleanElementText,
  outermost,
  pushMessage,
  roleFromHints,
} from "./base.parser";

export const TURN_STRATEGIES = [
  { label: "data-message-author-role", selector: "[data-message-author-role]" },
  {
    label: "conversation-turn",
    selector: '[data-testid^="conversation-turn"], [data-testid="conversation-turn"]',
  },
  { label: "data-message-id", selector: "[data-message-id]" },
  {
    label: "message-class",
    selector: '[class*="user-message"], [class*="assistant-message"]',
  },
] as const;

const CONTENT_SELECTORS = [
  ".markdown",
  ".whitespace-pre-wrap",
  "[data-message-author-role]",
  '[class*="message-content"], [class*="message-body"]',
  '[data-testid*="message-body"]',
] as const;

const MIN_TEXT_LENGTH = 1;

function roleOf(turn: Element, index: number): MessageRole {
  const inner = turn.querySelector("[data-message-author-role]");
  return roleFromHints(
    {
      authorRole:
        turn.getAttribute("data-message-author-role") ||
        inner?.getAttribute("data-message-author-role") ||
        null,
      author:
        turn.getAttribute("data-message-author") ||
        inner?.getAttribute("data-message-author") ||
        null,
      role: turn.getAttribute("data-role"),
      className: classNamesOf(turn),
    },
    index,
  );
}

function textOf(turn: Element): string {
  for (const selector of CONTENT_SELECTORS) {
    const el = turn.matches(selector) ? turn : turn.querySelector(selector);
    if (!el) continue;
    const text = cleanElementText(el).trim();
    if (text) return text;
  }
  return cleanElementText(turn).trim();
}

export function parseChatGPT(doc: Document): ChatMessage[] {
  const tried: string[] = [];

  for (const strategy of TURN_STRATEGIES) {
    const candidates = outermost([...doc.querySelectorAll(strategy.selector)]);
    tried.push(`${strategy.label}=${candidates.length}`);
    if (candidates.length === 0) continue;

    const messages: ChatMessage[] = [];
    let index = 0;
    for (const turn of candidates) {
      const text = textOf(turn);
      if (text.length < MIN_TEXT_LENGTH) continue;

      if (messages[messages.length - 1]?.content === text) continue;
      pushMessage(messages, `msg_gpt_${strategy.label}_${index}`, roleOf(turn, index), text);
      index++;
    }

    if (messages.length > 0) {
      console.debug(`[AiToolkit] ChatGPT: ${messages.length} message(s) via "${strategy.label}"`);
      return messages;
    }
  }

  console.warn(`[AiToolkit] ChatGPT: no turn matched — probes: ${tried.join(", ")}`);
  return [];
}
