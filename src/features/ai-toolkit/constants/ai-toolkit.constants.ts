import type { CavemanSettings } from "../types/ai-toolkit.types";

export const AI_TOOLKIT_ACTIONS = {
  SCRAPE_DOM: "ai_toolkit:scrape_dom",
  EXPORT_FILE: "ai_toolkit:export_file",
  DOWNLOAD_CONTENT: "ai_toolkit:download_content",
} as const;

export const AI_TOOLKIT_STORAGE_KEYS = {
  HISTORY: "local:ai_toolkit_history",
  CAVEMAN_SETTINGS: "local:ai_toolkit_caveman",
} as const;

export const DEFAULT_CAVEMAN_SETTINGS: CavemanSettings = {
  enabled: false,
  level: "full",
  sites: {},
};

export const CAVEMAN_LEVELS = ["lite", "full", "ultra"] as const;
export type CavemanLevel = (typeof CAVEMAN_LEVELS)[number];

export function isValidCavemanLevel(level: unknown): level is CavemanLevel {
  return typeof level === "string" && (CAVEMAN_LEVELS as readonly string[]).includes(level);
}

export const CAVEMAN_HINTS: Record<CavemanLevel, string> = {
  lite: "Lite: No filler, no pleasantries, keeps full sentences.",
  full: "Full: Classic caveman terseness. Drops articles, fragments OK.",
  ultra: "Ultra: Maximum compression. Technical shorthand, arrows (X → Y).",
} as const;

export type SupportedAiPlatform = "chatgpt" | "claude" | "gemini" | "deepseek" | "generic";

export interface PlatformConfig {
  readonly id: SupportedAiPlatform;
  readonly name: string;
  readonly domains: readonly string[];
  readonly color: string;
}

export const AI_PLATFORMS: Record<SupportedAiPlatform, PlatformConfig> = {
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    domains: ["chatgpt.com", "chat.openai.com"],
    color: "#10a37f",
  },
  claude: {
    id: "claude",
    name: "Claude",
    domains: ["claude.ai"],
    color: "#d97706",
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    domains: ["gemini.google.com"],
    color: "#3b82f6",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    domains: ["chat.deepseek.com"],
    color: "#6366f1",
  },
  generic: {
    id: "generic",
    name: "Web Chat",
    domains: [],
    color: "#64748b",
  },
} as const;
