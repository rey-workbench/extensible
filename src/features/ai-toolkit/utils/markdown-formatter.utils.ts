import type { ChatConversation } from "../types/ai-toolkit.types";

export class MarkdownFormatterUtils {
  /**
   * Formats a ChatConversation into standard GitHub-flavored Markdown with metadata frontmatter.
   */
  public static format(
    convo: ChatConversation,
    options: { includeMetadata?: boolean } = {}
  ): string {
    const { includeMetadata = true } = options;
    const lines: string[] = [];

    if (includeMetadata) {
      lines.push("---");
      lines.push(`title: "${convo.title.replace(/"/g, '\\"')}"`);
      lines.push(`platform: ${convo.platform}`);
      lines.push(`date: ${new Date(convo.createdAt).toISOString()}`);
      if (convo.url) {
        lines.push(`source: "${convo.url}"`);
      }
      lines.push(`messages: ${convo.messages.length}`);
      if (convo.totalWords) {
        lines.push(`word_count: ${convo.totalWords}`);
      }
      lines.push("---\n");
    }

    lines.push(`# ${convo.title}\n`);

    convo.messages.forEach((msg, _index) => {
      const isUser = msg.role === "user";
      const roleLabel = isUser ? "🧑 User" : "🤖 Assistant";
      lines.push(`### ${roleLabel}\n`);
      lines.push(msg.content.trim());
      lines.push("\n---\n");
    });

    return lines.join("\n");
  }

  /**
   * Formats conversation into plain text (e.g. for quick clipboard pasting).
   */
  public static formatPlainText(convo: ChatConversation): string {
    const lines: string[] = [];
    lines.push(`${convo.title.toUpperCase()}\n${"=".repeat(convo.title.length)}\n`);

    convo.messages.forEach((msg) => {
      const role = msg.role.toUpperCase();
      lines.push(`[${role}]:\n${msg.content.trim()}\n`);
    });

    return lines.join("\n");
  }
}
