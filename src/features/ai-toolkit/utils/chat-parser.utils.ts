import { createUniqueId, delay } from "@/lib/utils";
import { AI_PLATFORMS, type SupportedAiPlatform } from "../constants/ai-toolkit.constants";
import type { ChatConversation, ChatMessage, MessageRole } from "../types/ai-toolkit.types";

export class ChatParserUtils {
  /**
   * Identifies which AI platform corresponds to the given hostname or current location.
   */
  public static detectPlatform(hostname: string = window.location.hostname): SupportedAiPlatform {
    const host = hostname.toLowerCase();
    for (const [key, config] of Object.entries(AI_PLATFORMS)) {
      if (key === "generic") continue;
      if (config.domains.some((d) => host.includes(d))) {
        return key as SupportedAiPlatform;
      }
    }
    return "generic";
  }

  /**
   * Scrapes chat messages from the current DOM based on detected or specified platform.
   */
  public static parseActivePage(doc: Document = document): ChatConversation | null {
    const hostname = doc.defaultView?.location?.hostname || window.location.hostname;
    const platform = this.detectPlatform(hostname);
    let messages: ChatMessage[] = [];

    switch (platform) {
      case "chatgpt":
        messages = this.parseChatGPT(doc);
        break;
      case "claude":
        messages = this.parseClaude(doc);
        break;
      case "gemini":
        messages = this.parseGemini(doc);
        break;
      case "deepseek":
        messages = this.parseDeepSeek(doc);
        break;
      default:
        messages = this.parseGeneric(doc);
        break;
    }

    if (messages.length === 0) {
      // Fallback try generic if specialized parser yielded 0
      console.warn(`[AiToolkit] No messages parsed on "${platform}" — falling back to generic.`);
      messages = this.parseGeneric(doc);
    }

    if (messages.length === 0) {
      return null;
    }

    const title = this.extractTitle(doc, messages);
    const totalWords = messages.reduce(
      (acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length,
      0
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
  public static async scrapeConvo(
    doc: Document,
    options: { hydrate?: boolean; actionLabel?: string } = {}
  ): Promise<ChatConversation> {
    if (options.hydrate) {
      await this.hydrateVirtualizedChat(doc);
    }
    const convo = this.parseActivePage(doc);
    if (!convo || convo.messages.length === 0) {
      throw new Error(`No chat messages detected to ${options.actionLabel ?? "export"}.`);
    }
    return convo;
  }

  /**
   * ChatGPT DOM extractor
   */
  public static parseChatGPT(doc: Document): ChatMessage[] {
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
        const text = this.cleanElementText(contentEl);

        if (text) {
          this.pushMessage(messages, `msg_gpt_${index}`, role, text);
        }
      });
      return messages;
    }

    // Secondary selector for varying ChatGPT web versions
    const rawTurns = doc.querySelectorAll("[data-message-author-role]");
    rawTurns.forEach((el, index) => {
      const authorRole = el.getAttribute("data-message-author-role");
      const role: MessageRole = authorRole === "user" ? "user" : "assistant";
      const text = this.cleanElementText(el);
      if (text) {
        this.pushMessage(messages, `msg_gpt_raw_${index}`, role, text);
      }
    });

    return messages;
  }

  /**
   * Claude DOM extractor
   */
  public static parseClaude(doc: Document): ChatMessage[] {
    const messages: ChatMessage[] = [];
    // Claude messages are usually grouped in rows or containers with font-claude-message or font-user-message
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
        const text = this.cleanElementText(el);
        if (text) {
          this.pushMessage(messages, `msg_claude_${index}`, role, text);
        }
      });
      return messages;
    }

    return this.parseGeneric(doc);
  }

  /**
   * Gemini DOM extractor
   */
  public static parseGemini(doc: Document): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 1. Primary: Gemini web components (user-query and model-response)
    const turns = doc.querySelectorAll("user-query, model-response");
    if (turns.length > 0) {
      turns.forEach((el, index) => {
        const tagName = el.tagName.toLowerCase();
        const isUser = tagName === "user-query";
        const role: MessageRole = isUser ? "user" : "assistant";
        const contentEl = !isUser ? el.querySelector("message-content") || el : el;
        const text = this.cleanElementText(contentEl);

        if (text) {
          this.pushMessage(messages, `msg_gemini_${index}`, role, text);
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
        const text = this.cleanElementText(el);

        if (text) {
          this.pushMessage(messages, `msg_gemini_sec_${index}`, role, text);
        }
      });

      if (messages.length > 0) {
        return messages;
      }
    }

    return this.parseGeneric(doc);
  }

  /**
   * DeepSeek DOM extractor
   */
  public static parseDeepSeek(doc: Document): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const elements = doc.querySelectorAll(
      '.ds-message, div[class*="chat-message"], div[class*="message-bubble"]'
    );

    elements.forEach((el, index) => {
      const isUser = el.classList.contains("ds-message-user") || el.className.includes("user");
      const role: MessageRole = isUser ? "user" : "assistant";
      const text = this.cleanElementText(el);

      if (text) {
        this.pushMessage(messages, `msg_ds_${index}`, role, text);
      }
    });

    return messages;
  }

  /**
   * Generic DOM extractor using structural heuristics
   */
  public static parseGeneric(doc: Document): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const candidates = doc.querySelectorAll(
      '[role="article"], [role="listitem"], .message, .chat-item, [class*="message-item"]'
    );

    candidates.forEach((el, index) => {
      const text = this.cleanElementText(el);
      if (text && text.length > 5) {
        const isUser =
          /user|human|me|prompt/i.test(el.className) ||
          /user|human|me/i.test(el.getAttribute("data-role") || "");
        this.pushMessage(messages, `msg_gen_${index}`, isUser ? "user" : "assistant", text);
      }
    });

    return messages;
  }

  /**
   * Auto-scrolls virtualized scroll containers to hydrate all conversation turns.
   */
  public static async hydrateVirtualizedChat(doc: Document = document): Promise<void> {
    const scrollContainer = doc.querySelector(
      'main, [class*="react-scroll-to-bottom"], [class*="conversation-container"], [data-scroll-anchor]'
    ) as HTMLElement | null;
    if (!scrollContainer) return;

    try {
      // Scroll to top briefly to trigger mount of previous turns
      scrollContainer.scrollTop = 0;
      await delay(250);
      // Scroll back to bottom
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      await delay(150);
    } catch {
      // Non-critical if scrolling is prevented
    }
  }

  /**
   * Extracts clean Markdown representation, preserving code snippets, lists, and formatting.
   */
  public static cleanElementText(element: Element): string {
    const clone = element.cloneNode(true) as HTMLElement;
    const doc = element.ownerDocument || document;

    // 1. Strip unneeded UI controls (buttons, toolbars, copy icons, SVGs, action bars)
    const unwanted = clone.querySelectorAll(
      'button, svg, [role="button"], .copy-code-button, [aria-hidden="true"], [class*="action-bar"], [class*="copy-button"], [class*="feedback"], [data-testid*="copy"], [class*="response-footer"], [class*="bottom-actions"], [class*="actions-container"], sources-list, [class*="sources-list"], [class*="citation"], mat-icon'
    );
    unwanted.forEach((el) => {
      el.remove();
    });

    // 2. Pre-process code blocks before generic text extraction
    const pres = clone.querySelectorAll("pre");
    pres.forEach((pre) => {
      const codeEl = pre.querySelector("code");
      const langClass = (codeEl?.className || pre.className || "").match(
        /language-([a-zA-Z0-9_-]+)/
      );
      const dataLang = codeEl?.getAttribute("data-language") || pre.getAttribute("data-language");
      const lang = langClass ? langClass[1] : dataLang || "";
      const rawCode = (codeEl || pre).textContent || "";
      pre.replaceWith(doc.createTextNode(`\n\`\`\`${lang}\n${rawCode.trim()}\n\`\`\`\n`));
    });

    // 3. Pre-process inline code elements
    clone.querySelectorAll("code").forEach((code) => {
      const text = code.textContent || "";
      code.replaceWith(doc.createTextNode(` \`${text.trim()}\` `));
    });

    // 4. Pre-process bold & italic elements
    clone.querySelectorAll("strong, b").forEach((el) => {
      el.replaceWith(doc.createTextNode(`**${el.textContent?.trim() || ""}**`));
    });
    clone.querySelectorAll("em, i").forEach((el) => {
      el.replaceWith(doc.createTextNode(`*${el.textContent?.trim() || ""}*`));
    });

    // 5. Pre-process links
    clone.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      const text = a.textContent?.trim();
      if (href && text && !href.startsWith("#")) {
        a.replaceWith(doc.createTextNode(`[${text}](${href})`));
      }
    });

    // 6. Pre-process headings
    for (let i = 1; i <= 6; i++) {
      const hashes = "#".repeat(i);
      clone.querySelectorAll(`h${i}`).forEach((h) => {
        h.replaceWith(doc.createTextNode(`\n${hashes} ${h.textContent?.trim() || ""}\n`));
      });
    }

    // 7. Pre-process list items
    clone.querySelectorAll("li").forEach((li) => {
      li.replaceWith(doc.createTextNode(`\n- ${li.textContent?.trim() || ""}`));
    });

    // 8. Pre-process blockquotes
    clone.querySelectorAll("blockquote").forEach((bq) => {
      const text = bq.textContent?.trim() || "";
      bq.replaceWith(doc.createTextNode(`\n> ${text.replace(/\n/g, "\n> ")}\n`));
    });

    // 9. Normalize paragraphs and whitespace
    clone.querySelectorAll("p").forEach((p) => {
      p.replaceWith(doc.createTextNode(`\n${p.textContent?.trim() || ""}\n`));
    });

    const result = clone.textContent || "";
    return result.replace(/\n{3,}/g, "\n\n").trim();
  }

  /** Appends a parsed message with a stable id + capture timestamp. */
  private static pushMessage(
    messages: ChatMessage[],
    id: string,
    role: MessageRole,
    content: string
  ): void {
    messages.push({ id, role, content, timestamp: Date.now() });
  }

  /**
   * Determines reasonable title from document or conversation content
   */
  public static extractTitle(doc: Document, messages: readonly ChatMessage[]): string {
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
}
