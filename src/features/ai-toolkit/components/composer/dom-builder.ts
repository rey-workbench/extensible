import {
  FONT_STACK,
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
    enabled && isValidCavemanLevel(settings.level) ? `ext-lvl-${settings.level}` : "";
  return `
    <div class="ext-composer-bar flex h-8 select-none items-center gap-1 whitespace-nowrap rounded-full px-2.5 transition-all"
      style="font-family: ${FONT_STACK}; ${
        enabled
          ? `background: ${WARNING_BG}; border: 1px solid ${WARNING_DARK}; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);`
          : `background: ${SURFACE}; border: 1px solid ${INK_BORDER}; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);`
      }">
      <!-- Caveman Toggle Button -->
      <button type="button" class="ext-bar-btn ext-caveman-toggle-btn flex h-6.5 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2 text-label font-bold outline-none transition-all hover:bg-black/5" style="color: #1A1A1A;" title="Caveman Mode: ${statusText} (Click to cycle level)">
        ${renderIcon("caveman", 16, `ext-caveman-icon ${enabled ? "text-[#C48C1E]" : "text-ext-muted"}`)}
        <span class="ext-bar-btn-text text-label font-bold tracking-[0.1px]" style="color: #1A1A1A;">Caveman</span>
        <span class="ext-bar-badge ext-lvl-badge ${badgeClass} rounded-full px-2 py-0.5 text-micro font-bold uppercase leading-none tracking-[0.4px] transition-colors ${
          enabled
            ? "border border-[#C48C1E] bg-ext-warning text-[#1A1A1A]"
            : "border border-[#E2E8F0] bg-[#F1F5F9] text-ext-text-secondary"
        }">${statusText}</span>
      </button>

      <div class="ext-bar-divider mx-1 h-4 w-px bg-ext-border"></div>

      <!-- Export Menu Button -->
      <div class="ext-export-wrapper inline-flex">
        <button type="button" class="ext-bar-btn ext-export-trigger-btn flex h-6.5 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2 text-label font-bold outline-none transition-all hover:bg-black/5" style="color: #1A1A1A;" title="Export Conversation">
          ${renderIcon("download", 13)}
          <span class="ext-bar-btn-text text-label font-bold tracking-[0.1px]" style="color: #1A1A1A;">Export</span>
          <span class="ext-export-caret text-chip opacity-75 transition-transform" style="color: #1A1A1A;">▾</span>
        </button>
      </div>
    </div>
  `;
}

export function buildMenuHtml(): string {
  return `
    <div class="ext-composer-menu-header flex items-center justify-between rounded-full px-3 py-1.5 text-chip font-bold uppercase tracking-wide text-ext-primary" style="background: #F1F5F9;">
      <span>Export Conversation</span>
      <button type="button" class="ext-composer-menu-close ext-close-btn h-6 w-6 shrink-0 rounded-lg text-body font-bold leading-none" title="Close menu">✕</button>
    </div>
    <div class="pt-1.5 flex flex-col gap-1">
      <button type="button" class="ext-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-left text-body font-semibold text-ext-text outline-none transition-all hover:bg-[#F1F5F9] hover:text-ext-text" data-format="markdown">
        ${renderIcon("markdown", 13, "text-ext-primary")}
        <span>Markdown (.md)</span>
      </button>
      <button type="button" class="ext-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-left text-body font-semibold text-ext-text outline-none transition-all hover:bg-[#F1F5F9] hover:text-ext-text" data-format="pdf">
        ${renderIcon("pdf", 13, "text-ext-danger")}
        <span>Print to PDF</span>
      </button>
      <button type="button" class="ext-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-left text-body font-semibold text-ext-text outline-none transition-all hover:bg-[#F1F5F9] hover:text-ext-text" data-format="json">
        ${renderIcon("json", 13, "text-[#b45309]")}
        <span>JSON (.json)</span>
      </button>
      <button type="button" class="ext-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-left text-body font-semibold text-ext-text outline-none transition-all hover:bg-[#F1F5F9] hover:text-ext-text" data-format="html">
        ${renderIcon("html", 13, "text-ext-primary")}
        <span>HTML Document</span>
      </button>
      <div class="ext-composer-menu-divider my-1 h-px bg-ext-subtle-strong"></div>
      <button type="button" class="ext-composer-menu-item ext-composer-copy-btn flex w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-left text-body font-medium text-ext-text outline-none transition-all hover:bg-[#F1F5F9] hover:text-ext-text">
        ${renderIcon("copy", 13, "text-ext-muted")}
        <span>Copy to Clipboard</span>
      </button>
    </div>
  `;
}

export function updateCavemanButtonUi(
  container: HTMLElement | null,
  settings: CavemanSettings,
): void {
  if (!container) return;
  const bar = container.querySelector<HTMLElement>(".ext-composer-bar");
  const icon = container.querySelector<SVGElement>(".ext-caveman-icon");
  const badge = container.querySelector<HTMLElement>(".ext-lvl-badge");
  const btn = container.querySelector<HTMLButtonElement>(".ext-caveman-toggle-btn");

  const { enabled, level } = settings;
  const statusText = cavemanStatusText(settings);

  if (bar) {
    if (enabled) {
      bar.style.background = WARNING_BG;
      bar.style.border = `1px solid ${WARNING_DARK}`;
      bar.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.12)";
      bar.classList.add("ext-caveman-on");
    } else {
      bar.style.background = SURFACE;
      bar.style.border = `1px solid ${INK_BORDER}`;
      bar.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.12)";
      bar.classList.remove("ext-caveman-on");
    }
  }
  if (icon) {
    icon.style.color = enabled ? WARNING_DARK : MUTED;
  }
  if (badge) {
    badge.textContent = statusText;
    if (enabled) {
      badge.className = `ext-bar-badge ext-lvl-badge rounded-full px-2 py-0.5 text-micro font-bold uppercase leading-none tracking-[0.4px] transition-colors border border-[#C48C1E] bg-[#E8A727] text-[#1A1A1A] ext-lvl-${level}`;
    } else {
      badge.className =
        "ext-bar-badge ext-lvl-badge rounded-full px-2 py-0.5 text-micro font-bold uppercase leading-none tracking-[0.4px] transition-colors border border-[#E2E8F0] bg-[#F1F5F9] text-ext-text-secondary";
    }
  }
  if (btn) {
    btn.title = `Caveman Mode: ${statusText} (Click to cycle level)`;
  }
}
