import { createUniqueId, delay } from "@/lib/utils";
import { AI_PLATFORMS, type SupportedAiPlatform } from "../constants/ai-toolkit.constants";
import type { ChatConversation, ChatMessage } from "../types/ai-toolkit.types";
import { parseChatGPT } from "./parsers/chatgpt.parser";
import { parseClaude } from "./parsers/claude.parser";
import { parseDeepSeek } from "./parsers/deepseek.parser";
import { parseGemini } from "./parsers/gemini.parser";
import { parseGeneric } from "./parsers/generic.parser";

export function detectPlatform(hostname: string = window.location.hostname): SupportedAiPlatform {
  const host = hostname.toLowerCase();
  for (const [key, config] of Object.entries(AI_PLATFORMS)) {
    if (key === "generic") continue;
    if (config.domains.some((d) => host.includes(d))) {
      return key as SupportedAiPlatform;
    }
  }
  return "generic";
}

export function parseActivePage(doc: Document = document): ChatConversation | null {
  const hostname = doc.defaultView?.location?.hostname || window.location.hostname;
  const platform = detectPlatform(hostname);
  let messages: ChatMessage[] = [];

  switch (platform) {
    case "chatgpt":
      messages = parseChatGPT(doc);
      break;
    case "claude":
      messages = parseClaude(doc);
      break;
    case "gemini":
      messages = parseGemini(doc);
      break;
    case "deepseek":
      messages = parseDeepSeek(doc);
      break;
    default:
      messages = parseGeneric(doc);
      break;
  }

  if (messages.length === 0) {
    console.warn(`[AiToolkit] No messages parsed on "${platform}" — falling back to generic.`);
    messages = parseGeneric(doc);
  }

  if (messages.length === 0) {
    return null;
  }

  const title = extractTitle(doc, messages);
  const totalWords = messages.reduce(
    (acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length,
    0,
  );

  return {
    id: createUniqueId("chat", 7),
    title,
    platform,
    url: doc.defaultView?.location?.href || window.location.href,
    createdAt: Date.now(),
    messages,
    totalWords,
  };
}

/**
 * One-shot scrape: optional virtualized-list hydration, parse, and validation.
 * Shared by content controller, popup controller, and popup callbacks.
 * @throws Error when no messages are detected (message names the action via `actionLabel`).
 */
export async function scrapeConvo(
  doc: Document,
  options: { hydrate?: boolean; actionLabel?: string } = {},
): Promise<ChatConversation> {
  if (options.hydrate) {
    await hydrateVirtualizedChat(doc);
  }
  const convo = parseActivePage(doc);
  if (!convo || convo.messages.length === 0) {
    throw new Error(`No chat messages detected to ${options.actionLabel ?? "export"}.`);
  }
  return convo;
}

export async function hydrateVirtualizedChat(doc: Document = document): Promise<void> {
  const scrollContainer = doc.querySelector(
    'main, [class*="react-scroll-to-bottom"], [class*="conversation-container"], [data-scroll-anchor]',
  ) as HTMLElement | null;
  if (!scrollContainer) return;

  try {
    scrollContainer.scrollTop = 0;
    await delay(250);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await delay(150);
  } catch {}
}

export function extractTitle(doc: Document, messages: readonly ChatMessage[]): string {
  const docTitle = doc.title ? doc.title.replace(/\s*[-–|].*$/, "").trim() : "";
  if (docTitle && !["ChatGPT", "Claude", "Gemini", "DeepSeek", "New Chat"].includes(docTitle)) {
    return docTitle;
  }

  const firstUserMsg = messages.find((m) => m.role === "user");
  if (firstUserMsg?.content) {
    const snippet = firstUserMsg.content
      .slice(0, 60)
      .replace(/[\r\n]+/g, " ")
      .trim();
    return snippet.length >= 60 ? `${snippet}...` : snippet;
  }

  return `AI Chat - ${new Date().toLocaleDateString()}`;
}

export const ChatParserUtils = {
  detectPlatform,
  parseActivePage,
  scrapeConvo,
  hydrateVirtualizedChat,
  extractTitle,
};
