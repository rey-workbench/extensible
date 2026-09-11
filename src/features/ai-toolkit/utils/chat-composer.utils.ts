import { setNativeValue } from "@/lib/browser";

const EDITOR_SELECTORS: readonly string[] = [
  "#prompt-textarea",
  'div.ProseMirror[contenteditable="true"]',
  '.ql-editor[contenteditable="true"]',
  'rich-textarea div[contenteditable="true"]',
  "#chat-input",
  'textarea[placeholder*="DeepSeek"]',
  'div[contenteditable="true"][translate="no"]',
  'div[contenteditable="true"]',
  "textarea",
];

const SEND_SELECTORS: readonly string[] = [
  "#composer-submit-button",
  'button[data-testid="send-button"]',
  'button[data-testid*="send" i]',
  'button[aria-label*="Send" i]',
  'button[aria-label*="send" i]',
  'button[aria-label*="Kirim" i]',
  'button[aria-label*="kirim" i]',
  'button[aria-label*="Prompt" i]',
  'button[aria-label*="prompt" i]',
  ".send-button",
  'div[class*="send-button"]',
  'button[class*="send"]',
  'button[type="submit"]',
];

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== "hidden";
}

export function getEditor(root: Document | HTMLElement = document): HTMLElement | null {
  for (const sel of EDITOR_SELECTORS) {
    const el = root.querySelector<HTMLElement>(sel);
    if (el && isVisible(el)) return el;
  }
  return null;
}

export function getComposerBox(root: Document | HTMLElement = document): HTMLElement | null {
  const editor = getEditor(root);
  if (!editor) return null;

  const form = editor.closest("form");
  if (form && form instanceof HTMLElement) return form;

  const unified = editor.closest<HTMLElement>(
    '[data-type="unified-composer"], [data-composer-grid], [data-composer-surface], [class*="chat-input-area"], [class*="input-area"]',
  );
  if (unified) return unified;

  let current: HTMLElement | null = editor.parentElement;
  for (let i = 0; i < 8 && current && current !== document.body; i++) {
    const isEditorContainer =
      current.classList.contains("ProseMirror") ||
      current.className.includes("prosemirror") ||
      current.className.includes("editor") ||
      current.className.includes("fallbackTextarea");

    if (!isEditorContainer) {
      const hasButton = current.querySelector(
        'button:not(.aio-bar-btn):not(.aio-composer-menu-item), [role="button"]:not(.aio-bar-btn)',
      );
      if (hasButton && current.clientWidth > 150) {
        return current;
      }
    }
    current = current.parentElement;
  }

  return editor.closest("form") || editor.parentElement;
}

export function getSendButton(root: Document | HTMLElement = document): HTMLElement | null {
  const box = getComposerBox(root);
  if (box) {
    for (const sel of SEND_SELECTORS) {
      const btn = box.querySelector<HTMLElement>(sel);
      if (btn && isVisible(btn)) return btn;
    }
  }

  for (const sel of SEND_SELECTORS) {
    const btn = root.querySelector<HTMLElement>(sel);
    if (btn && isVisible(btn)) return btn;
  }

  return null;
}

export function getText(editor: HTMLElement): string {
  if (editor instanceof HTMLTextAreaElement) {
    return editor.value;
  }
  return editor.innerText || editor.textContent || "";
}

export function setText(editor: HTMLElement, text: string): void {
  editor.focus();

  if (editor instanceof HTMLTextAreaElement) {
    setNativeValue(editor, text);
    return;
  }

  if (document.queryCommandSupported?.("insertText")) {
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("insertText", false, text);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
  }

  editor.textContent = text;
  try {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {}
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}
