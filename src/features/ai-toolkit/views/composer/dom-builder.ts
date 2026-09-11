import {
  FONT_STACK,
  INK,
  BORDER as INK_BORDER,
  MUTED,
  SURFACE,
  WARNING_BG,
  WARNING_DARK,
} from "@/lib/design-tokens";
import { renderIcon } from "@/lib/icons";
import { isValidCavemanLevel } from "../../constants/ai-toolkit.constants";
import type { CavemanSettings } from "../../types/ai-toolkit.types";

export function formatExportError(err: unknown): string {
  if (err instanceof Error && err.message) return `Export failed: ${err.message}`;
  return "Export failed";
}

function cavemanStatusText(settings: CavemanSettings): string {
  const { enabled, level } = settings;
  const levelValid = isValidCavemanLevel(level);
  return enabled ? (levelValid ? level.toUpperCase() : "STOP") : "OFF";
}

export function buildToolbarHtml(settings: CavemanSettings): string {
  const { enabled } = settings;
  const statusText = cavemanStatusText(settings);
  const badgeClass =
    enabled && isValidCavemanLevel(settings.level) ? `aio-lvl-${settings.level}` : "";
  return `
    <div class="aio-composer-bar flex h-7 select-none items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 transition-all"
      style="font-family: ${FONT_STACK}; ${
        enabled
          ? `background: ${WARNING_BG}; border: 1.5px solid ${WARNING_DARK}; box-shadow: 2px 2px 0 ${INK};`
          : `background: ${SURFACE}; border: 1.5px solid ${INK_BORDER}; box-shadow: 2px 2px 0 ${INK};`
      }">
      <!-- Caveman Toggle Button -->
      <button type="button" class="aio-bar-btn aio-caveman-toggle-btn flex h-5.5 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-1.5 text-[11.5px] font-bold outline-none transition-all hover:bg-[#EDE7DA]" style="color: #1A1A1A;" title="Caveman Mode: ${statusText} (Click to cycle level)">
        ${renderIcon("flame", 13, `aio-flame-icon ${enabled ? "text-[#C48C1E]" : "text-ext-muted"}`)}
        <span class="aio-bar-btn-text text-[11px] font-bold tracking-[0.1px]" style="color: #1A1A1A;">Caveman</span>
        <span class="aio-bar-badge aio-lvl-badge ${badgeClass} rounded-[3px] px-1.5 py-px text-[8.5px] font-bold uppercase leading-none tracking-[0.4px] transition-colors ${
          enabled
            ? "border border-[#C48C1E] bg-ext-warning text-ext-text"
            : "border border-[#D4CEC2] bg-[#EDE7DA] text-ext-text-secondary"
        }">${statusText}</span>
      </button>

      <div class="aio-bar-divider mx-0.5 h-3.5 w-px bg-ext-border"></div>

      <!-- Export Menu Button -->
      <div class="aio-export-wrapper inline-flex">
        <button type="button" class="aio-bar-btn aio-export-trigger-btn flex h-5.5 cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-1.5 text-[11.5px] font-bold outline-none transition-all hover:bg-[#EDE7DA]" style="color: #1A1A1A;" title="Export Conversation">
          ${renderIcon("download", 13)}
          <span class="aio-bar-btn-text text-[11px] font-bold tracking-[0.1px]" style="color: #1A1A1A;">Export</span>
          <span class="aio-export-caret text-[9px] opacity-75 transition-transform" style="color: #1A1A1A;">▾</span>
        </button>
      </div>
    </div>
  `;
}

export function buildMenuHtml(): string {
  return `
    <div class="aio-composer-menu-header flex items-center justify-between rounded-[5px] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ext-primary" style="background: #EDE7DA;">
      <span>Export Conversation</span>
      <button type="button" class="aio-composer-menu-close flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-solid border-ext-border bg-ext-surface p-0 text-[11px] leading-none text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text" title="Close menu">✕</button>
    </div>
    <div class="pt-1 flex flex-col gap-0.5">
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-[5px] border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-semibold text-ext-text outline-none transition-all hover:bg-[#EDE7DA] hover:text-ext-text" data-format="markdown">
        ${renderIcon("markdown", 13, "text-ext-primary")}
        <span>Markdown (.md)</span>
      </button>
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-[5px] border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-semibold text-ext-text outline-none transition-all hover:bg-[#EDE7DA] hover:text-ext-text" data-format="pdf">
        ${renderIcon("pdf", 13, "text-ext-danger")}
        <span>Print to PDF</span>
      </button>
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-[5px] border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-semibold text-ext-text outline-none transition-all hover:bg-[#EDE7DA] hover:text-ext-text" data-format="json">
        ${renderIcon("json", 13, "text-[#C48C1E]")}
        <span>JSON (.json)</span>
      </button>
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-[5px] border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-semibold text-ext-text outline-none transition-all hover:bg-[#EDE7DA] hover:text-ext-text" data-format="html">
        ${renderIcon("html", 13, "text-ext-primary")}
        <span>HTML Document</span>
      </button>
      <div class="aio-composer-menu-divider my-1 h-px bg-ext-border/20"></div>
      <button type="button" class="aio-composer-menu-item aio-composer-copy-btn flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-medium text-[#1c2130] outline-none transition-all hover:bg-[#f1f2f7] hover:text-[#1c2130]">
        ${renderIcon("copy", 13, "text-ext-muted")}
        <span>Copy to Clipboard</span>
      </button>
    </div>
  `;
}

export function updateCavemanButtonUi(
  container: HTMLElement | null,
  settings: CavemanSettings
): void {
  if (!container) return;
  const bar = container.querySelector<HTMLElement>(".aio-composer-bar");
  const icon = container.querySelector<SVGElement>(".aio-flame-icon");
  const badge = container.querySelector<HTMLElement>(".aio-lvl-badge");
  const btn = container.querySelector<HTMLButtonElement>(".aio-caveman-toggle-btn");

  const { enabled, level } = settings;
  const statusText = cavemanStatusText(settings);

  if (bar) {
    if (enabled) {
      bar.style.background = WARNING_BG;
      bar.style.border = `1.5px solid ${WARNING_DARK}`;
      bar.style.boxShadow = `2px 2px 0 ${INK}`;
      bar.classList.add("aio-caveman-on");
    } else {
      bar.style.background = SURFACE;
      bar.style.border = `1.5px solid ${INK_BORDER}`;
      bar.style.boxShadow = `2px 2px 0 ${INK}`;
      bar.classList.remove("aio-caveman-on");
    }
  }
  if (icon) {
    icon.style.color = enabled ? WARNING_DARK : MUTED;
  }
  if (badge) {
    badge.textContent = statusText;
    if (enabled) {
      badge.className = `aio-bar-badge aio-lvl-badge rounded-[3px] px-1.5 py-px text-[8.5px] font-bold uppercase leading-none tracking-[0.4px] transition-colors border border-[#C48C1E] bg-[#E8A727] text-[#1A1A1A] aio-lvl-${level}`;
    } else {
      badge.className =
        "aio-bar-badge aio-lvl-badge rounded-[3px] px-1.5 py-px text-[8.5px] font-bold uppercase leading-none tracking-[0.4px] transition-colors border border-[#D4CEC2] bg-[#EDE7DA] text-ext-text-secondary";
    }
  }
  if (btn) {
    btn.title = `Caveman Mode: ${statusText} (Click to cycle level)`;
  }
}
