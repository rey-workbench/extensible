import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";
import { cleanElementText, pushMessage } from "./base.parser";
import { parseGeneric } from "./generic.parser";

export function parseClaude(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const turns = doc.querySelectorAll(
    'div[data-is-streaming], div[class*="font-claude-message"], div[class*="font-user-message"], div[data-test-render-count]'
  );

  if (turns.length > 0) {
    turns.forEach((el, index) => {
      const isUser =
        el.className.includes("font-user-message") ||
        !!el.querySelector('[data-testid*="user"]') ||
        !!el.closest('[class*="user"]');

      const role: MessageRole = isUser ? "user" : "assistant";
      const text = cleanElementText(el);
      if (text) {
        pushMessage(messages, `msg_claude_${index}`, role, text);
      }
    });
    return messages;
  }

  return parseGeneric(doc);
}
