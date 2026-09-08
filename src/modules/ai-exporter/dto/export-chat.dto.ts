import type { ChatConversation, ExportFormat } from "../types/ai-exporter.types";

export class ExportChatDto {
  public readonly conversation: ChatConversation;
  public readonly format: ExportFormat;
  public readonly filename?: string;

  constructor(data: {
    conversation: ChatConversation;
    format?: ExportFormat;
    filename?: string;
  }) {
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
    const validFormats: ExportFormat[] = ["markdown", "json", "html", "text", "pdf"];
    if (!validFormats.includes(this.format)) {
      throw new Error(`ExportChatDto validation failed: unsupported format '${this.format}'`);
    }
  }
}
