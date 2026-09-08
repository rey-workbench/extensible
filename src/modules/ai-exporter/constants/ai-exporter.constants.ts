/**
 * Action and event constants specific to the AiExporter module.
 */

export const AI_EXPORTER_ACTIONS = {
  GET_ACTIVE_CHAT: "ai_exporter:get_active_chat",
  SCRAPE_DOM: "ai_exporter:scrape_dom",
  EXPORT_FILE: "ai_exporter:export_file",
  DOWNLOAD_CONTENT: "ai_exporter:download_content",
  OPEN_PRINT_VIEW: "ai_exporter:open_print_view",
  COPY_CLIPBOARD: "ai_exporter:copy_clipboard",
  GET_HISTORY: "ai_exporter:get_history",
  DELETE_HISTORY_ITEM: "ai_exporter:delete_history_item",
  CLEAR_HISTORY: "ai_exporter:clear_history",
  GET_PLATFORM_INFO: "ai_exporter:get_platform_info",
  GET_CAVEMAN_SETTINGS: "ai_exporter:get_caveman_settings",
  SET_CAVEMAN_SETTINGS: "ai_exporter:set_caveman_settings",
} as const;

export const AI_EXPORTER_STORAGE_KEYS = {
  HISTORY: "ai_exporter_history",
  SETTINGS: "ai_exporter_settings",
  CAVEMAN_SETTINGS: "ai_exporter_caveman",
} as const;

export const CAVEMAN_LEVELS = ["lite", "full", "ultra"] as const;
export type CavemanLevel = (typeof CAVEMAN_LEVELS)[number];

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
