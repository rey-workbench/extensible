import { escapeHtml } from "@/core";
import { renderIcon } from "./icons";

export interface ModalOptions {
  id: string;
  title: string;
  contentHtml?: string;
  footerHtml?: string;
  className?: string;
}

export function renderModal(options: ModalOptions): string {
  const titleId = `${options.id}Title`;
  const closeBtnId = `${options.id}CloseBtn`;
  const bodyId = `${options.id}Body`;

  return `
    <div class="ext-modal-backdrop ${options.className || ""}" id="${escapeHtml(options.id)}" style="display: none;">
      <div class="ext-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(titleId)}">
        <div class="ext-modal-header">
          <h3 class="ext-modal-title" id="${escapeHtml(titleId)}">${escapeHtml(options.title)}</h3>
          <button type="button" class="ext-icon-btn ext-modal-close" id="${escapeHtml(closeBtnId)}" title="Close" aria-label="Close">
            ${renderIcon("close", 16)}
          </button>
        </div>
        <div class="ext-modal-body" id="${escapeHtml(bodyId)}">
          ${options.contentHtml || ""}
        </div>
        ${options.footerHtml ? `<div class="ext-modal-footer">${options.footerHtml}</div>` : ""}
      </div>
    </div>
  `.trim();
}
