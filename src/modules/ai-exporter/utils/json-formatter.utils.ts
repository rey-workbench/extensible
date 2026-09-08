import type { ChatConversation } from "../types/ai-exporter.types";

export class JsonFormatterUtils {
  /**
   * Formats a ChatConversation into structured JSON with 2-space indentation.
   */
  public static format(convo: ChatConversation): string {
    return JSON.stringify(
      {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        conversation: convo,
      },
      null,
      2
    );
  }
}
