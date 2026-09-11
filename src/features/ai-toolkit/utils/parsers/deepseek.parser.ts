import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";
import { cleanElementText, pushMessage } from "./base.parser";

export function parseDeepSeek(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const elements = doc.querySelectorAll(
    '.ds-message, div[class*="chat-message"], div[class*="message-bubble"]'
  );

  elements.forEach((el, index) => {
    const isUser = el.classList.contains("ds-message-user") || el.className.includes("user");
    const role: MessageRole = isUser ? "user" : "assistant";
    const text = cleanElementText(el);

    if (text) {
      pushMessage(messages, `msg_ds_${index}`, role, text);
    }
  });

  return messages;
}
