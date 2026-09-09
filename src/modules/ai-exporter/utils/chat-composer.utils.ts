export class ChatComposerUtils {
  private static readonly EDITOR_SELECTORS: readonly string[] = [
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

  private static readonly SEND_SELECTORS: readonly string[] = [
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

  /**
   * Finds the currently active or visible prompt editor.
   */
  public static getEditor(root: Document | HTMLElement = document): HTMLElement | null {
    for (const sel of this.EDITOR_SELECTORS) {
      const el = root.querySelector<HTMLElement>(sel);
      if (el && this.isVisible(el)) return el;
    }
    return null;
  }

  /**
   * Finds the enclosing chat input form or composer box.
   */
  public static getComposerBox(root: Document | HTMLElement = document): HTMLElement | null {
    const editor = this.getEditor(root);
    if (!editor) return null;

    // 1. Primary: Enclosing form element
    const form = editor.closest("form");
    if (form && form instanceof HTMLElement) return form;

    // 2. Semantic composer wrappers (explicit containers, exclude ProseMirror)
    const unified = editor.closest<HTMLElement>(
      '[data-type="unified-composer"], [data-composer-grid], [data-composer-surface], [class*="chat-input-area"], [class*="input-area"]'
    );
    if (unified) return unified;

    // 3. Ascend parents looking for one that holds external action buttons
    let current: HTMLElement | null = editor.parentElement;
    for (let i = 0; i < 8 && current && current !== document.body; i++) {
      const isEditorContainer =
        current.classList.contains("ProseMirror") ||
        current.className.includes("prosemirror") ||
        current.className.includes("editor") ||
        current.className.includes("fallbackTextarea");

      if (!isEditorContainer) {
        const hasButton = current.querySelector(
          'button:not(.aio-bar-btn):not(.aio-composer-menu-item), [role="button"]:not(.aio-bar-btn)'
        );
        if (hasButton && current.clientWidth > 150) {
          return current;
        }
      }
      current = current.parentElement;
    }

    return editor.closest("form") || editor.parentElement;
  }

  /**
   * Finds the send button inside the composer or document.
   */
  public static getSendButton(root: Document | HTMLElement = document): HTMLElement | null {
    const box = this.getComposerBox(root);
    if (box) {
      for (const sel of this.SEND_SELECTORS) {
        const btn = box.querySelector<HTMLElement>(sel);
        if (btn && this.isVisible(btn)) return btn;
      }
    }

    for (const sel of this.SEND_SELECTORS) {
      const btn = root.querySelector<HTMLElement>(sel);
      if (btn && this.isVisible(btn)) return btn;
    }

    return null;
  }

  /**
   * Reads current text from editor (handles textarea & contenteditable).
   */
  public static getText(editor: HTMLElement): string {
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value;
    }
    return editor.innerText || editor.textContent || "";
  }

  /**
   * Sets text into the editor and dispatches synthetic input events for framework reactivity.
   */
  public static setText(editor: HTMLElement, text: string): void {
    editor.focus();

    if (editor instanceof HTMLTextAreaElement) {
      const proto = window.HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(editor, text);
      } else {
        editor.value = text;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // ContentEditable handling (ProseMirror, Quill, Lexical).
    // execCommand("insertText") is deprecated but still the only way to keep
    // ProseMirror's transaction history correct; fallback below covers modern
    // engines where the API is absent.
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

    // Fallback — preserves line breaks for contenteditable without execCommand support.
    // Using textContent avoids collapsing whitespace differently from innerText.
    editor.textContent = text;
    // Place caret at end so the user can keep typing.
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

  private static isVisible(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== "hidden";
  }
}
