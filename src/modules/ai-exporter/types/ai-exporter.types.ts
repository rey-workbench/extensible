import type { CavemanLevel, SupportedAiPlatform } from "../constants/ai-exporter.constants";

export type { CavemanLevel, SupportedAiPlatform };

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly timestamp?: number;
}

export interface ChatConversation {
  readonly id: string;
  readonly title: string;
  readonly platform: SupportedAiPlatform;
  readonly url: string;
  readonly createdAt: number;
  readonly messages: readonly ChatMessage[];
  readonly totalWords?: number;
}

export type ExportFormat = "markdown" | "json" | "html" | "text" | "pdf";

export interface ExportResult {
  readonly success: boolean;
  readonly filename?: string;
  readonly error?: string;
  readonly format: ExportFormat;
}

export interface ExportHistoryItem {
  readonly id: string;
  readonly title: string;
  readonly platform: SupportedAiPlatform;
  readonly messageCount: number;
  readonly exportedAt: number;
  readonly format: ExportFormat;
  readonly url: string;
  readonly content?: string;
}

export interface CavemanSettings {
  readonly enabled: boolean;
  readonly level: CavemanLevel;
  readonly sites: Record<string, boolean>;
}
