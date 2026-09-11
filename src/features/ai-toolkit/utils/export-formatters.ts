import { escapeHtml } from "@/lib/browser";
import type { ChatConversation } from "../types/ai-toolkit.types";

export function formatJson(convo: ChatConversation): string {
  return JSON.stringify(
    {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      conversation: convo,
    },
    null,
    2,
  );
}

export function formatMarkdown(
  convo: ChatConversation,
  options: { includeMetadata?: boolean } = {},
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

export function formatPlainText(convo: ChatConversation): string {
  const lines: string[] = [];
  lines.push(`${convo.title.toUpperCase()}\n${"=".repeat(convo.title.length)}\n`);

  convo.messages.forEach((msg) => {
    const role = msg.role.toUpperCase();
    lines.push(`[${role}]:\n${msg.content.trim()}\n`);
  });

  return lines.join("\n");
}

function formatMessageBody(content: string): string {
  const codeBlocks: string[] = [];
  let processed = content.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`);
    return `__CODE_BLOCK_${idx}__`;
  });

  processed = escapeHtml(processed);

  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  processed = processed.replace(/\n/g, "<br>");

  codeBlocks.forEach((block, idx) => {
    processed = processed.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  return processed;
}

export function formatHtml(convo: ChatConversation, options: { autoPrint?: boolean } = {}): string {
  const title = escapeHtml(convo.title);
  const dateStr = new Date(convo.createdAt).toLocaleString();
  const { autoPrint = false } = options;

  const messagesHtml = convo.messages
    .map((msg) => {
      const isUser = msg.role === "user";
      const roleLabel = isUser ? "User" : "Assistant";
      const roleClass = isUser ? "role-user" : "role-assistant";
      const formattedContent = formatMessageBody(msg.content);

      return `
      <div class="message ${roleClass}">
        <div class="message-header">
          <span class="role-tag">${roleLabel}</span>
        </div>
        <div class="message-body">${formattedContent}</div>
      </div>`;
    })
    .join("\n");

  const autoPrintScript = autoPrint
    ? `<script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AI Chat Export</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #1e293b;
      --border: #e2e8f0;
      --user-bg: #f8fafc;
      --asst-bg: #ffffff;
      --code-bg: #0f172a;
      --code-text: #f8fafc;
      --primary: #3b82f6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #090d16;
        --text: #f1f5f9;
        --border: #1e293b;
        --user-bg: #111827;
        --asst-bg: #090d16;
        --code-bg: #020617;
        --code-text: #f8fafc;
      }
    }
    body {
      font-family: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      max-width: 820px;
      margin: 0 auto;
      padding: 2rem 1rem;
      line-height: 1.6;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    .meta { font-size: 0.85rem; color: #64748b; }
    .message {
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 1.5rem;
      overflow: hidden;
      background: var(--asst-bg);
    }
    .message.role-user {
      background: var(--user-bg);
    }
    .message-header {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--border);
      font-weight: 600;
      font-size: 0.8rem;
    }
    .message-body {
      padding: 1rem;
      word-break: break-word;
    }
    pre {
      background: var(--code-bg);
      color: var(--code-text);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.85rem;
      line-height: 1.45;
      margin: 0.75rem 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.88em;
      background: rgba(125, 125, 125, 0.15);
      padding: 0.15em 0.35em;
      border-radius: 4px;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    @media print {
      body { max-width: 100%; padding: 0; background: #fff; color: #000; }
      .message { break-inside: avoid; border-color: #cbd5e1; }
      pre { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    }
  </style>
  ${autoPrintScript}
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="meta">Platform: ${convo.platform.toUpperCase()} • Exported: ${dateStr} • Messages: ${convo.messages.length}</div>
  </header>
  <main>
    ${messagesHtml}
  </main>
</body>
</html>`;
}

export const JsonFormatterUtils = { format: formatJson };
export const MarkdownFormatterUtils = { format: formatMarkdown, formatPlainText };
export const HtmlFormatterUtils = { format: formatHtml };
