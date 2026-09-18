import type { SupportedAiPlatform } from "@/features/ai-toolkit/constants/ai-toolkit.constants";

export interface ParserFixture {
  name: string;

  origin: string;

  platform: SupportedAiPlatform;
  html: string;

  expect: {
    count: number;
    roles?: string[];
    includes?: string[];
  } | null;
}

const CHATGPT_CLASSIC = `
<main>
  <article data-testid="conversation-turn-1">
    <div data-message-author-role="user" data-message-id="u1">
      <div class="whitespace-pre-wrap">Explain the parser bug</div>
    </div>
  </article>
  <article data-testid="conversation-turn-2">
    <div data-message-author-role="assistant" data-message-id="a1">
      <div class="markdown">
        <p>The issue is <strong>selector drift</strong>.</p>
        <pre><code class="language-ts">const a = 1;</code></pre>
        <ul><li>first</li><li>second</li></ul>
      </div>
      <button data-testid="copy-turn-action-button">Copy</button>
    </div>
  </article>
</main>`;

const CHATGPT_SECTIONS = `
<main>
  <section data-testid="conversation-turn-3">
    <div class="turn-body" data-message-author-role="user"><p>second layout</p></div>
  </section>
  <section data-testid="conversation-turn-4">
    <div class="turn-body" data-message-author-role="assistant">
      <div class="markdown"><p>still found</p></div>
    </div>
  </section>
</main>`;

const CHATGPT_MESSAGE_ID = `
<main>
  <div data-message-id="m1" data-role="user"><span>no testids here</span></div>
  <div data-message-id="m2" class="assistant-message"><span>answer without turn wrappers</span></div>
</main>`;

const CHATGPT_LOGGED_OUT = `
<main>
  <div class="user-message"><div class="body">logged out bubble</div></div>
  <div class="assistant-message"><div class="body">logged out reply</div></div>
</main>`;

const CHATGPT_EMPTY_PAGE = `
<main>
  <nav><div class="message">Navigation item that is not a message</div></nav>
  <article class="empty-card">Short</article>
  <footer><p>Footer copy that is long enough to matter</p></footer>
</main>`;

const CLAUDE_TURNS = `
<main>
  <div class="font-user-message" data-test-render-count="1"><p>how do I test this</p></div>
  <div class="font-claude-message" data-test-render-count="2">
    <p>One saved fixture per site.</p>
  </div>
</main>`;

const GEMINI_ELEMENTS = `
<main>
  <user-query><div class="query-text">what changed</div></user-query>
  <model-response><message-content><p>The selectors drifted.</p></message-content></model-response>
</main>`;

const GEMINI_CLASSES = `
<main>
  <div class="user-query-container"><p>class based question</p></div>
  <div class="model-response-container"><p>class based answer</p></div>
</main>`;

const DEEPSEEK_MESSAGES = `
<main>
  <div class="ds-message ds-message-user"><p>deepseek question</p></div>
  <div class="ds-message"><p>deepseek answer</p></div>
</main>`;

const GENERIC_BUBBLES = `
<main>
  <div role="article"><p>unknown site question</p></div>
  <div role="article"><p>unknown site answer</p></div>
</main>`;

export const FIXTURES: ParserFixture[] = [
  {
    name: "chatgpt.classic",
    origin: "https://chatgpt.com/c/abc",
    platform: "chatgpt",
    html: CHATGPT_CLASSIC,
    expect: {
      count: 2,
      roles: ["user", "assistant"],
      includes: ["**selector drift**", "```ts", "- first"],
    },
  },
  {
    name: "chatgpt.section-turns",
    origin: "https://chatgpt.com/c/abc",
    platform: "chatgpt",
    html: CHATGPT_SECTIONS,
    expect: { count: 2, roles: ["user", "assistant"] },
  },
  {
    name: "chatgpt.message-id-only",
    origin: "https://chat.openai.com/c/abc",
    platform: "chatgpt",
    html: CHATGPT_MESSAGE_ID,
    expect: { count: 2, roles: ["user", "assistant"] },
  },
  {
    name: "chatgpt.logged-out",
    origin: "https://chatgpt.com/",
    platform: "chatgpt",
    html: CHATGPT_LOGGED_OUT,
    expect: { count: 2, roles: ["user", "assistant"] },
  },
  {
    name: "chatgpt.no-conversation",
    origin: "https://chatgpt.com/",
    platform: "chatgpt",
    html: CHATGPT_EMPTY_PAGE,
    expect: null,
  },
  {
    name: "claude.turns",
    origin: "https://claude.ai/chat/abc",
    platform: "claude",
    html: CLAUDE_TURNS,
    expect: {
      count: 2,
      roles: ["user", "assistant"],
      includes: ["One saved fixture per site."],
    },
  },
  {
    name: "gemini.custom-elements",
    origin: "https://gemini.google.com/app/abc",
    platform: "gemini",
    html: GEMINI_ELEMENTS,
    expect: { count: 2, roles: ["user", "assistant"], includes: ["The selectors drifted."] },
  },
  {
    name: "gemini.class-fallback",
    origin: "https://gemini.google.com/app/abc",
    platform: "gemini",
    html: GEMINI_CLASSES,
    expect: { count: 2, roles: ["user", "assistant"] },
  },
  {
    name: "deepseek.messages",
    origin: "https://chat.deepseek.com/a/chat/abc",
    platform: "deepseek",
    html: DEEPSEEK_MESSAGES,
    expect: { count: 2, roles: ["user", "assistant"] },
  },
  {
    name: "generic.unknown-site",
    origin: "https://some-new-chat.example.com/thread/1",
    platform: "generic",
    html: GENERIC_BUBBLES,
    expect: { count: 2, roles: ["user", "assistant"] },
  },
];
