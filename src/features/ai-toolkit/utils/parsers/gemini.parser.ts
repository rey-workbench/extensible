import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";
import { cleanElementText, pushMessage } from "./base.parser";
import { parseGeneric } from "./generic.parser";

/** Gemini DOM extractor */
export function parseGemini(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // 1. Primary: Gemini web components (user-query and model-response)
  const turns = doc.querySelectorAll("user-query, model-response");
  if (turns.length > 0) {
    turns.forEach((el, index) => {
      const tagName = el.tagName.toLowerCase();
      const isUser = tagName === "user-query";
      const role: MessageRole = isUser ? "user" : "assistant";
      const contentEl = !isUser ? el.querySelector("message-content") || el : el;
      const text = cleanElementText(contentEl);

      if (text) {
        pushMessage(messages, `msg_gemini_${index}`, role, text);
      }
    });

    if (messages.length > 0) {
      return messages;
    }
  }

  // 2. Secondary fallback: query & response containers by class or data attributes
  const secondaryTurns = doc.querySelectorAll(
    'div[class*="user-query"], div[class*="model-response"], [data-test-id*="user-query"], [data-test-id*="model-response"], .user-query-container, .model-response-container'
  );
  if (secondaryTurns.length > 0) {
    secondaryTurns.forEach((el, index) => {
      const isUser =
        /user/i.test(el.className) ||
        el.getAttribute("data-test-id")?.includes("user") ||
        el.tagName.toLowerCase().includes("user");
      const role: MessageRole = isUser ? "user" : "assistant";
      const text = cleanElementText(el);

      if (text) {
        pushMessage(messages, `msg_gemini_sec_${index}`, role, text);
      }
    });

    if (messages.length > 0) {
      return messages;
    }
  }

  return parseGeneric(doc);
}
