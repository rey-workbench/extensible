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
    throw new Error(
      `No chat messages detected to ${options.actionLabel ?? "export"}. Open the conversation, scroll through it, and try again.`,
    );
  }
  return convo;
}

function scrollableAncestorOf(el: HTMLElement | null): HTMLElement | null {
  let current = el;
  while (current && current !== current.ownerDocument.body) {
    if (current.scrollHeight - current.clientHeight > 80) return current;
    current = current.parentElement;
  }
  return null;
}

export function findTranscriptScroller(doc: Document = document): HTMLElement | null {
  const explicit = doc.querySelector<HTMLElement>(
    '[class*="react-scroll-to-bottom"], [class*="conversation-container"], [data-scroll-anchor]',
  );
  const explicitScroller = scrollableAncestorOf(explicit);
  if (explicitScroller) return explicitScroller;

  let best: HTMLElement | null = null;
  let bestRange = 120;
  const view = doc.defaultView;
  for (const el of doc.querySelectorAll<HTMLElement>("main *")) {
    const range = el.scrollHeight - el.clientHeight;
    if (range <= bestRange) continue;
    const overflowY = view?.getComputedStyle(el).overflowY ?? "";
    if (overflowY === "hidden" || overflowY === "clip") continue;
    best = el;
    bestRange = range;
  }

  return best ?? scrollableAncestorOf(doc.querySelector<HTMLElement>("main"));
}

const LAZY_TURN_THRESHOLD = 12;

export async function hydrateVirtualizedChat(doc: Document = document): Promise<void> {
  const mounted = doc.querySelectorAll(
    'article[data-testid^="conversation-turn"], [data-message-author-role], user-query, model-response, .ds-message',
  ).length;
  if (mounted < LAZY_TURN_THRESHOLD) return;

  const scroller = findTranscriptScroller(doc);
  if (!scroller || scroller.scrollHeight - scroller.clientHeight < 200) return;

  const previousTop = scroller.scrollTop;
  const range = scroller.scrollHeight - scroller.clientHeight;
  try {
    for (const ratio of [0, 1]) {
      scroller.scrollTop = Math.round(range * ratio);
      await delay(90);
    }
    scroller.scrollTop = previousTop;
    await delay(50);
  } catch {
    // Halaman dengan scroller terkunci: biarkan posisi apa adanya, isi sudah terbaca.
  }
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
