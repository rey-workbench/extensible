import type { ChatMessage } from "../../types/ai-toolkit.types";
import { classNamesOf, cleanElementText, pushMessage, roleFromHints } from "./base.parser";

const ELEMENT_SELECTOR = '.ds-message, div[class*="chat-message"], div[class*="message-bubble"]';

export function parseDeepSeek(doc: Document): ChatMessage[] {
  const messages: ChatMessage[] = [];

  doc.querySelectorAll(ELEMENT_SELECTOR).forEach((el, index) => {
    const text = cleanElementText(el).trim();
    if (!text) return;

    pushMessage(
      messages,
      `msg_ds_${index}`,
      roleFromHints({ className: classNamesOf(el) }, index),
      text,
    );
  });

  return messages;
}
