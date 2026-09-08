import { escapeHtml } from "@/core/index";

export interface CardOptions {
  id?: string;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: string;
}

export interface SectionHeaderOptions {
  id?: string;
  className?: string;
  badge?: string;
  action?: string;
}

export function renderCard(content: string, options?: CardOptions): string {
  const idAttr = options?.id ? `id="${escapeHtml(options.id)}"` : "";
  const classes = ["ext-card"];
  if (options?.className) classes.push(options.className);

  let headerHtml = "";
  if (options?.title || options?.headerAction) {
    headerHtml = `
      <div class="ext-card-header">
        <div class="ext-card-title-group">
          ${options.title ? `<h3 class="ext-card-title">${escapeHtml(options.title)}</h3>` : ""}
          ${options.subtitle ? `<span class="ext-card-subtitle">${escapeHtml(options.subtitle)}</span>` : ""}
        </div>
        ${options.headerAction ? `<div class="ext-card-header-action">${options.headerAction}</div>` : ""}
      </div>
    `;
  }

  return `
    <div ${idAttr} class="${classes.join(" ")}">
      ${headerHtml}
      <div class="ext-card-body">${content}</div>
    </div>
  `.trim();
}

export function renderSectionHeader(title: string, options?: SectionHeaderOptions): string {
  const idAttr = options?.id ? `id="${escapeHtml(options.id)}"` : "";
  const classes = ["ext-section-header"];
  if (options?.className) classes.push(options.className);

  return `
    <div ${idAttr} class="${classes.join(" ")}">
      <div class="ext-section-title-group">
        <span>${escapeHtml(title)}</span>
        ${options?.badge ? options.badge : ""}
      </div>
      ${options?.action ? `<div class="ext-section-action">${options.action}</div>` : ""}
    </div>
  `.trim();
}
