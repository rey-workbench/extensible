import { escapeHtml } from "@/core/index";

export interface EmptyStateOptions {
  id?: string;
  icon?: string;
  title: string;
  subtitle?: string;
  actionHtml?: string;
  className?: string;
}

export function renderEmptyState(options: EmptyStateOptions): string {
  const idAttr = options.id ? `id="${escapeHtml(options.id)}"` : "";
  const classes = ["ext-empty-state"];
  if (options.className) classes.push(options.className);

  return `
    <div ${idAttr} class="${classes.join(" ")}">
      ${options.icon ? `<div class="ext-empty-state-icon">${options.icon}</div>` : ""}
      <div class="ext-empty-state-title">${escapeHtml(options.title)}</div>
      ${options.subtitle ? `<div class="ext-empty-state-subtitle">${escapeHtml(options.subtitle)}</div>` : ""}
      ${options.actionHtml ? `<div class="ext-empty-state-action">${options.actionHtml}</div>` : ""}
    </div>
  `.trim();
}
