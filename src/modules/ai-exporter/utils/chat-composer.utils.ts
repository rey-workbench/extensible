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
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    ".send-button",
    'div[class*="send-button"]',
    'button[class*="send"]',
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

    // 1. Try closest semantic container
    const form = editor.closest(
      'form, fieldset, [class*="composer"], [class*="chat-input-area"], [class*="input-area"]'
    );
    if (form && form instanceof HTMLElement) return form;

    // 2. Ascend up to 5 parents to locate the shared wrapper with action buttons
    let current: HTMLElement | null = editor.parentElement;
    for (let i = 0; i < 5 && current; i++) {
      if (current.querySelector("button") && current.clientWidth > 150) {
        return current;
      }
      current = current.parentElement;
    }

    return editor.parentElement;
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
   * Finds the actions/toolbar row inside the composer to dock cleanly without covering text.
   */
  public static getActionsRow(root: Document | HTMLElement = document): HTMLElement | null {
    const sendBtn = this.getSendButton(root);
    if (sendBtn?.parentElement) {
      const parent = sendBtn.parentElement;
      const grandparent = parent.parentElement;

      // 1. If grandparent is a horizontal container (e.g. ChatGPT bottom bar)
      if (grandparent && grandparent instanceof HTMLElement && grandparent.clientWidth > 100) {
        const style = window.getComputedStyle(grandparent);
        if (style.display.includes("flex") || style.display.includes("grid")) {
          // Look for left-side actions container first (beside + or search tools)
          const leftActions = grandparent.querySelector<HTMLElement>(
            'div[class*="leading"], div[class*="start"], div[class*="left"], div:first-child'
          );
          if (
            leftActions &&
            leftActions !== parent &&
            leftActions.clientWidth > 10 &&
            !leftActions.contains(sendBtn)
          ) {
            return leftActions;
          }
          return grandparent;
        }
      }

      // 2. Direct parent of send button
      if (parent instanceof HTMLElement && parent.clientWidth > 20) {
        return parent;
      }
    }

    const editor = this.getEditor(root);
    const composerBox = this.getComposerBox(root);
    if (!composerBox) return null;

    // 3. Search for known actions/bottom row classes
    const candidates = composerBox.querySelectorAll<HTMLElement>(
      'div[class*="actions"], div[class*="trailing"], div[class*="bottom"], div[class*="tools"], div[class*="toolbar"], [class*="footer"]'
    );
    for (const cand of candidates) {
      if (cand !== editor && !cand.contains(editor) && cand.clientHeight > 15) {
        return cand;
      }
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

    // ContentEditable handling (ProseMirror, Quill, Lexical)
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

    // Fallback innerText
    editor.innerText = text;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private static isVisible(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== "hidden";
  }
}
