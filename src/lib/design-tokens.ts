export const DESIGN_TOKENS = {
  bg: "#F5F0E8",
  surface: "#FFFDF7",
  surfaceHover: "#EDE7DA",
  border: "#2B2B2B",
  text: "#1A1A1A",
  textSecondary: "#5A544C",
  muted: "#A89B8C",
  primary: "#1B4DDB",
  success: "#2D8C4E",
  danger: "#D63230",
  dangerDark: "#A82624",
  warning: "#C48C1E",
  warningBg: "#FDF3E3",
  fontStack: "'Space Grotesk', system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
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
