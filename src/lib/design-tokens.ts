/**
 * JS mirror of the palette for code that cannot consume CSS variables at build
 * time (the AI composer builds its DOM as an HTML string).
 *
 * Colors must stay in sync with the `@theme` block in `src/styles/global.css`,
 * and that file is the single source of truth for the type scale (`text-chip`,
 * `text-label`, `text-body`, `text-heading`, `text-hero`, …) — do not duplicate
 * font sizes here.
 */
export const DESIGN_TOKENS = {
  // Bento design system — soft, airy, card-first (matches BentoLauncher)
  bg: "#EAEFF5",
  surface: "#FFFFFF",
  surfaceHover: "#F1F5F9",
  border: "#E2E8F0",
  text: "#0F172A",
  textSecondary: "#475569",
  muted: "#64748B",
  primary: "#1A73E8",
  success: "#10B981",
  danger: "#EF4444",
  dangerDark: "#DC2626",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  fontStack:
    "'Plus Jakarta Sans', 'Inter', system-ui, 'Segoe UI', Roboto, Ubuntu, sans-serif",
} as const;

export const INK = DESIGN_TOKENS.text;
export const BORDER = DESIGN_TOKENS.border;
export const SURFACE = DESIGN_TOKENS.surface;
export const MUTED = DESIGN_TOKENS.muted;
export const SUCCESS = DESIGN_TOKENS.success;
export const DANGER = DESIGN_TOKENS.danger;
export const DANGER_DARK = DESIGN_TOKENS.dangerDark;
export const WARNING_DARK = DESIGN_TOKENS.warning;
export const WARNING_BG = DESIGN_TOKENS.warningBg;
export const FONT_STACK = DESIGN_TOKENS.fontStack;
