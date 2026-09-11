import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";

export function pushMessage(
  messages: ChatMessage[],
  id: string,
  role: MessageRole,
  content: string,
): void {
  messages.push({ id, role, content, timestamp: Date.now() });
}

export function cleanElementText(element: Element): string {
  const clone = element.cloneNode(true) as HTMLElement;
  const doc = element.ownerDocument || document;

  const unwanted = clone.querySelectorAll(
    'button, svg, [role="button"], .copy-code-button, [aria-hidden="true"], [class*="action-bar"], [class*="copy-button"], [class*="feedback"], [data-testid*="copy"], [class*="response-footer"], [class*="bottom-actions"], [class*="actions-container"], sources-list, [class*="sources-list"], [class*="citation"], mat-icon',
  );
  unwanted.forEach((el) => {
    el.remove();
  });

  const pres = clone.querySelectorAll("pre");
  pres.forEach((pre) => {
    const codeEl = pre.querySelector("code");
    const langClass = (codeEl?.className || pre.className || "").match(/language-([a-zA-Z0-9_-]+)/);
    const dataLang = codeEl?.getAttribute("data-language") || pre.getAttribute("data-language");
    const lang = langClass ? langClass[1] : dataLang || "";
    const rawCode = (codeEl || pre).textContent || "";
    pre.replaceWith(doc.createTextNode(`\n\`\`\`${lang}\n${rawCode.trim()}\n\`\`\`\n`));
  });

  clone.querySelectorAll("code").forEach((code) => {
    const text = code.textContent || "";
    code.replaceWith(doc.createTextNode(` \`${text.trim()}\` `));
  });

  clone.querySelectorAll("strong, b").forEach((el) => {
    el.replaceWith(doc.createTextNode(`**${el.textContent?.trim() || ""}**`));
  });
  clone.querySelectorAll("em, i").forEach((el) => {
    el.replaceWith(doc.createTextNode(`*${el.textContent?.trim() || ""}*`));
  });

  clone.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    const text = a.textContent?.trim();
    if (href && text && !href.startsWith("#")) {
      a.replaceWith(doc.createTextNode(`[${text}](${href})`));
    }
  });

  for (let i = 1; i <= 6; i++) {
    const hashes = "#".repeat(i);
    clone.querySelectorAll(`h${i}`).forEach((h) => {
      h.replaceWith(doc.createTextNode(`\n${hashes} ${h.textContent?.trim() || ""}\n`));
    });
  }

  clone.querySelectorAll("li").forEach((li) => {
    li.replaceWith(doc.createTextNode(`\n- ${li.textContent?.trim() || ""}`));
  });

  clone.querySelectorAll("blockquote").forEach((bq) => {
    const text = bq.textContent?.trim() || "";
    bq.replaceWith(doc.createTextNode(`\n> ${text.replace(/\n/g, "\n> ")}\n`));
  });

  clone.querySelectorAll("p").forEach((p) => {
    p.replaceWith(doc.createTextNode(`\n${p.textContent?.trim() || ""}\n`));
  });

  const result = clone.textContent || "";
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
