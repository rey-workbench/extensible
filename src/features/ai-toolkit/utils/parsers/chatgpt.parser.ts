import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";
import { cleanElementText, pushMessage } from "./base.parser";

/** ChatGPT DOM extractor */
export function parseChatGPT(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const articles = doc.querySelectorAll('article[data-testid^="conversation-turn"]');

  if (articles.length > 0) {
    articles.forEach((el, index) => {
      const isUser =
        !!el.querySelector('[data-message-author-role="user"]') ||
        !!el.querySelector('div[class*="user-message"]') ||
        !!el.querySelector('div[data-testid*="user"]');

      const role: MessageRole = isUser ? "user" : "assistant";
      const contentEl =
        el.querySelector(".markdown") || el.querySelector('div[class*="text-message"]') || el;
      const text = cleanElementText(contentEl);

      if (text) {
        pushMessage(messages, `msg_gpt_${index}`, role, text);
      }
    });
    return messages;
  }

  // Secondary selector for varying ChatGPT web versions
  const rawTurns = doc.querySelectorAll("[data-message-author-role]");
  rawTurns.forEach((el, index) => {
    const authorRole = el.getAttribute("data-message-author-role");
    const role: MessageRole = authorRole === "user" ? "user" : "assistant";
    const text = cleanElementText(el);
    if (text) {
      pushMessage(messages, `msg_gpt_raw_${index}`, role, text);
    }
  });

  return messages;
}
