import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";

/** Appends a parsed message with a stable id + capture timestamp. */
export function pushMessage(
  messages: ChatMessage[],
  id: string,
  role: MessageRole,
  content: string
): void {
  messages.push({ id, role, content, timestamp: Date.now() });
}

/**
 * Extracts clean Markdown representation, preserving code snippets, lists, and formatting.
 * Shared by every platform parser.
 */
export function cleanElementText(element: Element): string {
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
    const langClass = (codeEl?.className || pre.className || "").match(/language-([a-zA-Z0-9_-]+)/);
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
