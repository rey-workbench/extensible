import type { ChatMessage } from "../../types/ai-toolkit.types";
import { classNamesOf, cleanElementText, pushMessage, roleFromHints } from "./base.parser";

const SECONDARY_TURN_SELECTOR =
  'div[class*="user-query"], div[class*="model-response"], [data-test-id*="user-query"], [data-test-id*="model-response"], .user-query-container, .model-response-container';

export function parseGemini(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];

  doc.querySelectorAll("user-query, model-response").forEach((el, index) => {
    const isUser = el.tagName.toLowerCase() === "user-query";
    const contentEl = isUser ? el : el.querySelector("message-content") || el;
    const text = cleanElementText(contentEl).trim();
    if (!text) return;

    pushMessage(
      messages,
      `msg_gemini_${index}`,
      roleFromHints({ author: el.tagName }, index),
      text,
    );
  });
  if (messages.length > 0) return messages;

  doc.querySelectorAll(SECONDARY_TURN_SELECTOR).forEach((el, index) => {
    const text = cleanElementText(el).trim();
    if (!text) return;

    const role = roleFromHints(
      {
        author: el.getAttribute("data-test-id"),
        className: classNamesOf(el),
      },
      index,
    );
    pushMessage(messages, `msg_gemini_sec_${index}`, role, text);
  });

  return messages;
}
