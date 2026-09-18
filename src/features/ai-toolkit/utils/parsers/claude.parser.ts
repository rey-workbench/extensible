import type { ChatMessage } from "../../types/ai-toolkit.types";
import { classNamesOf, cleanElementText, pushMessage, roleFromHints } from "./base.parser";

const TURN_SELECTOR =
  'div[data-is-streaming], div[class*="font-claude-message"], div[class*="font-user-message"], div[data-test-render-count]';

export function parseClaude(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];

  doc.querySelectorAll(TURN_SELECTOR).forEach((el, index) => {
    const text = cleanElementText(el).trim();
    if (!text) return;

    const role = roleFromHints(
      {
        author: el.querySelector('[data-testid*="user"]')?.getAttribute("data-testid") ?? null,
        className: `${classNamesOf(el)} ${classNamesOf(el.closest('[class*="user"]') ?? el)}`,
      },
      index,
    );
    pushMessage(messages, `msg_claude_${index}`, role, text);
  });

  return messages;
}
