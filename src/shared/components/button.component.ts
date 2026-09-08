import { escapeHtml } from "@/core/index";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export type ButtonSize = "sm" | "md";

export interface ButtonOptions {
  id?: string;
  text?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: "left" | "right";
  title?: string;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  ariaLabel?: string;
  onClick?: (event: MouseEvent) => void;
}

export interface IconButtonOptions {
  id?: string;
  icon: string;
  title: string;
  variant?: "ghost" | "secondary" | "subtle";
  size?: ButtonSize;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

export function renderButton(options: ButtonOptions): string {
  const variant = options.variant || "secondary";
  const size = options.size || "md";
  const type = options.type || "button";
  const classes = ["ext-btn", `ext-btn-${variant}`, `ext-btn-${size}`];
  if (options.className) classes.push(options.className);

  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : "";
  const titleAttr = options.title ? `title="${escapeHtml(options.title)}"` : "";
  const ariaAttr = options.ariaLabel ? `aria-label="${escapeHtml(options.ariaLabel)}"` : "";
  const disabledAttr = options.disabled ? "disabled" : "";

  const textHtml = options.text
    ? `<span class="ext-btn-label">${escapeHtml(options.text)}</span>`
    : "";
  const iconHtml = options.icon ? `<span class="ext-btn-icon">${options.icon}</span>` : "";

  const content =
    options.iconPosition === "right" ? `${textHtml}${iconHtml}` : `${iconHtml}${textHtml}`;

  return `<button type="${type}" class="${classes.join(" ")}" ${idAttr} ${titleAttr} ${ariaAttr} ${disabledAttr}>${content}</button>`;
}

export function renderIconButton(options: IconButtonOptions): string {
  const variant = options.variant || "ghost";
  const size = options.size || "sm";
  const classes = ["ext-icon-btn", `ext-icon-btn-${variant}`, `ext-icon-btn-${size}`];
  if (options.className) classes.push(options.className);

  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : "";
  const titleAttr = `title="${escapeHtml(options.title)}"`;
  const ariaAttr = `aria-label="${escapeHtml(options.ariaLabel || options.title)}"`;
  const disabledAttr = options.disabled ? "disabled" : "";

  return `<button type="button" class="${classes.join(" ")}" ${idAttr} ${titleAttr} ${ariaAttr} ${disabledAttr}>${options.icon}</button>`;
}
