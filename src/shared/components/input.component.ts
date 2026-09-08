import { escapeHtml } from "@/core/index";
import { renderIcon } from "./icons";

export interface CopyInputOptions {
  id?: string;
  buttonId?: string;
  value?: string;
  placeholder?: string;
  readOnly?: boolean;
  buttonTitle?: string;
  className?: string;
}

export function renderCopyInput(options: CopyInputOptions): string {
  const inputId = options.id || "extCopyInput";
  const btnId = options.buttonId || "extCopyBtn";
  const value = options.value !== undefined ? options.value : "";
  const placeholder = options.placeholder || "";
  const buttonTitle = options.buttonTitle || "Copy";
  const readonlyAttr = (options.readOnly ?? true) ? "readonly" : "";

  return `
    <div class="ext-copy-input ${options.className || ""}">
      <input type="text" id="${escapeHtml(inputId)}" class="ext-copy-input-field" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${readonlyAttr} />
      <button type="button" id="${escapeHtml(btnId)}" class="ext-icon-btn ext-copy-input-btn" title="${escapeHtml(buttonTitle)}" aria-label="${escapeHtml(buttonTitle)}">
        ${renderIcon("copy", 16)}
      </button>
    </div>
  `.trim();
}
