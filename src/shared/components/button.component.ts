import { escapeHtml } from '@/core/index';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md';

export interface ButtonOptions {
  id?: string;
  text?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: 'left' | 'right';
  title?: string;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  onClick?: (event: MouseEvent) => void;
}

export interface IconButtonOptions {
  id?: string;
  icon: string;
  title: string;
  variant?: 'ghost' | 'secondary' | 'subtle';
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

export function renderButton(options: ButtonOptions): string {
  const variant = options.variant || 'secondary';
  const size = options.size || 'md';
  const type = options.type || 'button';
  const classes = ['ext-btn', `ext-btn-${variant}`, `ext-btn-${size}`];
  if (options.className) classes.push(options.className);

  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : '';
  const titleAttr = options.title ? `title="${escapeHtml(options.title)}"` : '';
  const ariaAttr = options.ariaLabel ? `aria-label="${escapeHtml(options.ariaLabel)}"` : '';
  const disabledAttr = options.disabled ? 'disabled' : '';

  const textHtml = options.text ? `<span class="ext-btn-label">${escapeHtml(options.text)}</span>` : '';
  const iconHtml = options.icon ? `<span class="ext-btn-icon">${options.icon}</span>` : '';

  const content = options.iconPosition === 'right'
    ? `${textHtml}${iconHtml}`
    : `${iconHtml}${textHtml}`;

  return `<button type="${type}" class="${classes.join(' ')}" ${idAttr} ${titleAttr} ${ariaAttr} ${disabledAttr}>${content}</button>`;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = options.type || 'button';
  const variant = options.variant || 'secondary';
  const size = options.size || 'md';
  btn.className = `ext-btn ext-btn-${variant} ext-btn-${size}${options.className ? ' ' + options.className : ''}`;

  if (options.id) btn.id = options.id;
  if (options.title) btn.title = options.title;
  if (options.ariaLabel) btn.setAttribute('aria-label', options.ariaLabel);
  if (options.disabled) btn.disabled = true;

  const textHtml = options.text ? `<span class="ext-btn-label">${escapeHtml(options.text)}</span>` : '';
  const iconHtml = options.icon ? `<span class="ext-btn-icon">${options.icon}</span>` : '';
  btn.innerHTML = options.iconPosition === 'right' ? `${textHtml}${iconHtml}` : `${iconHtml}${textHtml}`;

  if (options.onClick) {
    btn.addEventListener('click', options.onClick);
  }
  return btn;
}

export function renderIconButton(options: IconButtonOptions): string {
  const variant = options.variant || 'ghost';
  const size = options.size || 'sm';
  const classes = ['ext-icon-btn', `ext-icon-btn-${variant}`, `ext-icon-btn-${size}`];
  if (options.className) classes.push(options.className);

  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : '';
  const titleAttr = `title="${escapeHtml(options.title)}"`;
  const ariaAttr = `aria-label="${escapeHtml(options.ariaLabel || options.title)}"`;
  const disabledAttr = options.disabled ? 'disabled' : '';

  return `<button type="button" class="${classes.join(' ')}" ${idAttr} ${titleAttr} ${ariaAttr} ${disabledAttr}>${options.icon}</button>`;
}

export function createIconButton(options: IconButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  const variant = options.variant || 'ghost';
  const size = options.size || 'sm';
  btn.className = `ext-icon-btn ext-icon-btn-${variant} ext-icon-btn-${size}${options.className ? ' ' + options.className : ''}`;

  if (options.id) btn.id = options.id;
  btn.title = options.title;
  btn.setAttribute('aria-label', options.ariaLabel || options.title);
  if (options.disabled) btn.disabled = true;
  btn.innerHTML = options.icon;

  if (options.onClick) {
    btn.addEventListener('click', options.onClick);
  }
  return btn;
}
