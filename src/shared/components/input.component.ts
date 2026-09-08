import { escapeHtml } from '@/core/index';

export interface InputOptions {
  id?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: string;
}

export interface CopyInputOptions {
  id?: string;
  buttonId?: string;
  value?: string;
  placeholder?: string;
  readOnly?: boolean;
  buttonTitle?: string;
  className?: string;
}

const DEFAULT_COPY_ICON = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

export function renderInput(options: InputOptions): string {
  const type = options.type || 'text';
  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : '';
  const valueAttr = options.value !== undefined ? `value="${escapeHtml(options.value)}"` : '';
  const placeholderAttr = options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : '';
  const readonlyAttr = options.readOnly ? 'readonly' : '';
  const disabledAttr = options.disabled ? 'disabled' : '';

  const classes = ['ext-input'];
  if (options.className) classes.push(options.className);

  if (options.icon) {
    return `
      <div class="ext-input-group">
        <span class="ext-input-icon">${options.icon}</span>
        <input type="${type}" class="${classes.join(' ')}" ${idAttr} ${valueAttr} ${placeholderAttr} ${readonlyAttr} ${disabledAttr} />
      </div>
    `.trim();
  }

  return `<input type="${type}" class="${classes.join(' ')}" ${idAttr} ${valueAttr} ${placeholderAttr} ${readonlyAttr} ${disabledAttr} />`;
}

export function renderCopyInput(options: CopyInputOptions): string {
  const inputId = options.id || 'extCopyInput';
  const btnId = options.buttonId || 'extCopyBtn';
  const value = options.value !== undefined ? options.value : '';
  const placeholder = options.placeholder || '';
  const buttonTitle = options.buttonTitle || 'Copy';
  const readonlyAttr = options.readOnly ?? true ? 'readonly' : '';

  return `
    <div class="ext-copy-input ${options.className || ''}">
      <input type="text" id="${escapeHtml(inputId)}" class="ext-copy-input-field" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${readonlyAttr} />
      <button type="button" id="${escapeHtml(btnId)}" class="ext-icon-btn ext-copy-input-btn" title="${escapeHtml(buttonTitle)}" aria-label="${escapeHtml(buttonTitle)}">
        ${DEFAULT_COPY_ICON}
      </button>
    </div>
  `.trim();
}
