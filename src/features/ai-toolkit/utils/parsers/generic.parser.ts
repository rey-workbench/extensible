import type { ChatMessage } from "../../types/ai-toolkit.types";
import { classNamesOf, cleanElementText, pushMessage, roleFromHints } from "./base.parser";

const CANDIDATE_SELECTORS = [
  "[data-message-author-role]",
  "[data-message-id]",
  '[role="article"]',
  '[data-testid*="message"]',
  "article",
  '[class*="message-item"], [class*="message-bubble"]',
  '[class*="user-message"], [class*="assistant-message"], [class*="message"]',
  '.message, .chat-item, [role="listitem"]',
] as const;

const CHROME_SELECTOR = 'nav, header, footer, aside, [role="navigation"], [role="banner"]';

const MIN_TEXT_LENGTH = 6;

export function parseGeneric(doc: Document): ChatMessage[] {
  const seen = new Set<Element>();
  const candidates: { el: Element; text: string }[] = [];

  for (const selector of CANDIDATE_SELECTORS) {
    for (const el of doc.querySelectorAll(selector)) {
      if (seen.has(el) || el.closest(CHROME_SELECTOR)) continue;
      seen.add(el);
      const text = cleanElementText(el).trim();
      if (text.length < MIN_TEXT_LENGTH) continue;
      candidates.push({ el, text });
    }
  }

  const innermost = candidates.filter(
    ({ el }) => !candidates.some((other) => other.el !== el && el.contains(other.el)),
  );

  const messages: ChatMessage[] = [];
  let index = 0;
  for (const { el, text } of innermost) {
    if (messages[messages.length - 1]?.content === text) continue;
    const role = roleFromHints(
      {
        authorRole: el.getAttribute("data-message-author-role"),
        author: el.getAttribute("data-author"),
        role: el.getAttribute("data-role"),
        className: classNamesOf(el),
      },
      index,
    );
    pushMessage(messages, `msg_gen_${index}`, role, text);
    index++;
  }

  return messages;
}
