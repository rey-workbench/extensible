import type { ChatConversation, ExportFormat } from "../types/ai-exporter.types";

/** Canonical list of supported export formats (single source for DTO + service mapping). */
const EXPORT_FORMATS = [
  "markdown",
  "json",
  "html",
  "text",
  "pdf",
] as const satisfies readonly ExportFormat[];

/** Wire payload shape shared by DTO validation and router subscribe handlers. */
export interface ExportPayload {
  readonly conversation: ChatConversation;
  readonly format?: ExportFormat;
  readonly filename?: string;
}

export class ExportChatDto {
  public readonly conversation: ChatConversation;
  public readonly format: ExportFormat;
  public readonly filename?: string;

  constructor(data: ExportPayload) {
    if (!data?.conversation) {
      throw new Error("Invalid export request: missing conversation data");
    }

    this.conversation = data.conversation;
    this.format = data.format || "markdown";
    this.filename = data.filename;

    this.validate();
  }

  public validate(): void {
    if (!this.conversation.title || typeof this.conversation.title !== "string") {
      throw new Error("ExportChatDto validation failed: conversation title is required");
    }
    if (!Array.isArray(this.conversation.messages)) {
      throw new Error("ExportChatDto validation failed: messages array is required");
    }
    if (this.conversation.messages.length === 0) {
      throw new Error("ExportChatDto validation failed: cannot export empty conversation");
    }
    if (!EXPORT_FORMATS.includes(this.format)) {
      throw new Error(`ExportChatDto validation failed: unsupported format '${this.format}'`);
    }
  }
}
