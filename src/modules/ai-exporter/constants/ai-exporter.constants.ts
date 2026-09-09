/**
 * Action and event constants specific to the AiExporter module.
 */
import type { CavemanSettings } from "../types/ai-exporter.types";

export const AI_EXPORTER_ACTIONS = {
  SCRAPE_DOM: "ai_exporter:scrape_dom",
  EXPORT_FILE: "ai_exporter:export_file",
  DOWNLOAD_CONTENT: "ai_exporter:download_content",
  GET_HISTORY: "ai_exporter:get_history",
  DELETE_HISTORY_ITEM: "ai_exporter:delete_history_item",
  CLEAR_HISTORY: "ai_exporter:clear_history",
  GET_CAVEMAN_SETTINGS: "ai_exporter:get_caveman_settings",
  SET_CAVEMAN_SETTINGS: "ai_exporter:set_caveman_settings",
} as const;

export const AI_EXPORTER_STORAGE_KEYS = {
  HISTORY: "ai_exporter_history",
  CAVEMAN_SETTINGS: "ai_exporter_caveman",
} as const;

/** Single source of truth for Caveman defaults — reused by service, controllers, and views. */
export const DEFAULT_CAVEMAN_SETTINGS: CavemanSettings = {
  enabled: false,
  level: "full",
  sites: {},
};

export const CAVEMAN_LEVELS = ["lite", "full", "ultra"] as const;
export type CavemanLevel = (typeof CAVEMAN_LEVELS)[number];

/** Runtime guard: is this value a real Caveman level (storage may contain stale/garbage data)? */
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
