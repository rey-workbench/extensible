import { createUniqueId, delay } from "@/lib/utils";
import { AI_PLATFORMS, type SupportedAiPlatform } from "../constants/ai-toolkit.constants";
import type { ChatConversation, ChatMessage } from "../types/ai-toolkit.types";
import { parseChatGPT } from "./parsers/chatgpt.parser";
import { parseClaude } from "./parsers/claude.parser";
import { parseDeepSeek } from "./parsers/deepseek.parser";
import { parseGemini } from "./parsers/gemini.parser";
import { parseGeneric } from "./parsers/generic.parser";

export function detectPlatform(
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): SupportedAiPlatform {
  const host = hostname.toLowerCase();
  for (const [key, config] of Object.entries(AI_PLATFORMS)) {
    if (key === "generic") continue;
    if (config.domains.some((d) => host.includes(d))) {
      return key as SupportedAiPlatform;
    }
  }
  return "generic";
}

export function parseActivePage(doc?: Document): ChatConversation | null {
  const targetDoc = doc ?? (typeof document !== "undefined" ? document : null);
  if (!targetDoc) return null;
  const hostname =
    targetDoc.defaultView?.location?.hostname ||
    (typeof window !== "undefined" ? window.location.hostname : "");
  const platform = detectPlatform(hostname);
  let messages: ChatMessage[] = [];

  switch (platform) {
    case "chatgpt":
      messages = parseChatGPT(targetDoc);
      break;
    case "claude":
      messages = parseClaude(targetDoc);
      break;
    case "gemini":
      messages = parseGemini(targetDoc);
      break;
    case "deepseek":
      messages = parseDeepSeek(targetDoc);
      break;
    default:
      messages = parseGeneric(targetDoc);
      break;
  }

  if (messages.length === 0) {
    console.warn(`[AiToolkit] No messages parsed on "${platform}" — falling back to generic.`);
    messages = parseGeneric(targetDoc);
  }

  if (messages.length === 0) {
    return null;
  }

  const title = extractTitle(targetDoc, messages);
  const totalWords = messages.reduce(
    (acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length,
    0,
  );

  return {
    id: createUniqueId("chat", 7),
    title,
    platform,
    url:
      targetDoc.defaultView?.location?.href ||
      (typeof window !== "undefined" ? window.location.href : ""),
    createdAt: Date.now(),
    messages,
    totalWords,
  };
}

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

function extractTitle(doc: Document, messages: readonly ChatMessage[]): string {
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
