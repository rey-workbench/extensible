import { escapeHtml } from "@/core/index";

type BadgeVariant = "primary" | "success" | "danger" | "warning" | "neutral";

export interface BadgeOptions {
  id?: string;
  text: string;
  variant?: BadgeVariant;
  className?: string;
}

export interface StatusIndicatorOptions {
  id?: string;
  active?: boolean;
  label?: string;
  className?: string;
}

export interface CountdownOptions {
  id?: string;
  value?: string;
  className?: string;
}

export function renderBadge(options: BadgeOptions): string {
  const variant = options.variant || "neutral";
  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : "";
  const classes = ["ext-badge", `ext-badge-${variant}`];
  if (options.className) classes.push(options.className);

  return `<span ${idAttr} class="${classes.join(" ")}">${escapeHtml(options.text)}</span>`;
}

export function renderStatusIndicator(options: StatusIndicatorOptions): string {
  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : "";
  const statusClass = options.active ? "active" : "expired";
  const labelText = options.label || (options.active ? "Active" : "Expired");
  const dotId = options.id ? `id="${escapeHtml(options.id)}Dot"` : "";
  const textId = options.id ? `id="${escapeHtml(options.id)}Text"` : "";

  return `
    <div ${idAttr} class="ext-status-indicator ${options.className || ""}">
      <span ${dotId} class="ext-status-dot ${statusClass}"></span>
      <span ${textId} class="ext-status-text">${escapeHtml(labelText)}</span>
    </div>
  `.trim();
}

export function renderCountdown(options: CountdownOptions): string {
  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : "";
  const value = options.value || "--:--";
  return `<span ${idAttr} class="ext-countdown-chip ${options.className || ""}">${escapeHtml(value)}</span>`;
}
