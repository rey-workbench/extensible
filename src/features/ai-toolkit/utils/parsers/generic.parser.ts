import type { ChatMessage } from "../../types/ai-toolkit.types";
import { cleanElementText, pushMessage } from "./base.parser";

export function parseGeneric(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const candidates = doc.querySelectorAll(
    '[role="article"], [role="listitem"], .message, .chat-item, [class*="message-item"]'
  );

  candidates.forEach((el, index) => {
    const text = cleanElementText(el);
    if (text && text.length > 5) {
      const isUser =
        /user|human|me|prompt/i.test(el.className) ||
        /user|human|me/i.test(el.getAttribute("data-role") || "");
      pushMessage(messages, `msg_gen_${index}`, isUser ? "user" : "assistant", text);
    }
  });

  return messages;
}
