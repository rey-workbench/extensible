import type { ChatMessage, MessageRole } from "../../types/ai-toolkit.types";

export function pushMessage(
  messages: ChatMessage[],
  id: string,
  role: MessageRole,
  content: string,
): void {
  messages.push({ id, role, content, timestamp: Date.now() });
}

export interface RoleHints {
  authorRole?: string | null;
  author?: string | null;
  role?: string | null;
  className?: string | null;
}

const USER_HINTS = /(?:^|[^a-z])(?:user|human|me|prompt)(?:[^a-z]|$)/i;
const ASSISTANT_HINTS = /(?:^|[^a-z])(?:assistant|bot|model|ai|gpt|chatbot|claude)(?:[^a-z]|$)/i;

export function roleFromHints(hints: RoleHints, index: number): MessageRole {
  const attrText = [hints.authorRole, hints.author, hints.role]
    .filter((v): v is string => !!v)
    .join(" ")
    .toLowerCase();

  if (attrText) {
    if (USER_HINTS.test(attrText)) return "user";
    if (ASSISTANT_HINTS.test(attrText)) return "assistant";
  }

  const cls = hints.className || "";
  if (ASSISTANT_HINTS.test(cls) && !USER_HINTS.test(cls)) return "assistant";
  if (USER_HINTS.test(cls)) return "user";

  return index % 2 === 0 ? "user" : "assistant";
}

export function outermost(elements: readonly Element[]): Element[] {
  return elements.filter((el) => !elements.some((other) => other !== el && other.contains(el)));
}

export function classNamesOf(el: Element): string {
  return el.getAttribute("class") || "";
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
