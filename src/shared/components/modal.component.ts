import { escapeHtml } from '@/core/index';

export interface ModalOptions {
  id: string;
  title: string;
  contentHtml?: string;
  footerHtml?: string;
  className?: string;
}

const CLOSE_ICON = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

export function renderModal(options: ModalOptions): string {
  const titleId = `${options.id}Title`;
  const closeBtnId = `${options.id}CloseBtn`;
  const bodyId = `${options.id}Body`;

  return `
    <div class="ext-modal-backdrop ${options.className || ''}" id="${escapeHtml(options.id)}" style="display: none;">
      <div class="ext-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(titleId)}">
        <div class="ext-modal-header">
          <h3 class="ext-modal-title" id="${escapeHtml(titleId)}">${escapeHtml(options.title)}</h3>
          <button type="button" class="ext-icon-btn ext-modal-close" id="${escapeHtml(closeBtnId)}" title="Close" aria-label="Close">
            ${CLOSE_ICON}
          </button>
        </div>
        <div class="ext-modal-body" id="${escapeHtml(bodyId)}">
          ${options.contentHtml || ''}
        </div>
        ${options.footerHtml ? `<div class="ext-modal-footer">${options.footerHtml}</div>` : ''}
      </div>
    </div>
  `.trim();
}
