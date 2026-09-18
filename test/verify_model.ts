import assert from "node:assert";
import { readFileSync } from "node:fs";

console.log("[Test] Running WXT + Svelte Unit & Integration Tests...\n");

const sessionStore = new Map<string, unknown>();

function createFakeBrowser(): Record<string, unknown> {
  const listeners = new Set<(changes: unknown, area: string) => void>();
  const persistentStore = new Map<string, unknown>();

  const mkArea = (store: Map<string, unknown>, name: string) => ({
    get(
      keys: string | string[] | Record<string, unknown> | null | undefined,
    ): Record<string, unknown> {
      const wanted = Array.isArray(keys)
        ? keys
        : typeof keys === "string"
          ? [keys]
          : Object.keys(keys ?? {});
      const out: Record<string, unknown> = {};
      for (const k of wanted) if (store.has(k)) out[k] = store.get(k);
      return out;
    },
    set(items: Record<string, unknown>): void {
      const changes: Record<string, { oldValue?: unknown; newValue: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        const old = store.get(k);
        store.set(k, v);
        changes[k] = { oldValue: old, newValue: v };
      }
      for (const fn of listeners) fn(changes, name);
    },
    remove(keys: string | string[]): void {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
    },
    clear(): void {
      store.clear();
    },
  });

  return {
    runtime: { id: "test-extension" },
    storage: {
      local: mkArea(persistentStore, "local"),
      sync: mkArea(persistentStore, "sync"),
      session: mkArea(sessionStore, "session"),
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  };
}

interface FakeArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Record<string, unknown>;
  set(items: Record<string, unknown>): void;
  remove(keys: string | string[]): void;
  clear(): void;
}

interface FakeBrowser {
  storage: { local: FakeArea; sync: FakeArea; session: FakeArea };
}

const fakeBrowser = createFakeBrowser() as unknown as FakeBrowser;
(globalThis as Record<string, unknown>).browser = fakeBrowser;

const [
  { extractOtpCode, formatCountdown, sanitizeEmailHtml },
  { escapeHtml, formatRelativeTime, isContextInvalidated, slugify, setNativeValue },
  {
    clearHistory,
    deleteHistoryItem,
    formatConversation,
    generateFilename,
    getCavemanSettings,
    getHistory,
    readHistoryContent,
    recordHistory,
    updateCavemanSettings,
  },
  { detectPlatform },
  {
    buildPrimer,
    buildReminder,
    buildStop,
    hasStop,
    isPrefixed,
    isStopPrefixed,
    needsPrimer,
    wrapStop,
    wrapText,
  },
  { formatHtml, formatJson, formatMarkdown, formatPlainText },
  tempMail,
  { defineFeature, getFeatureColor },
  { isPrivateOrLocalHost },
  { getAllScriptTokens, getScriptToken, gmDelete, gmGet, gmList, gmSet },
  { DESIGN_TOKENS },
  { roleFromHints },
] = await Promise.all([
  import("@/features/temp-mail/utils/temp-mail.utils"),
  import("@/lib/browser"),
  import("@/features/ai-toolkit/services/ai-toolkit.service"),
  import("@/features/ai-toolkit/utils/chat-parser.utils"),
  import("@/features/ai-toolkit/utils/caveman-directive.utils"),
  import("@/features/ai-toolkit/utils/export-formatters"),
  import("@/features/temp-mail/services/temp-mail.service"),
  import("@/lib/feature-registry"),
  import("@/features/user-scripts/services/gm-rpc.service"),
  import("@/features/user-scripts/services/user-scripts.service"),
  import("@/lib/design-tokens"),
  import("@/features/ai-toolkit/utils/parsers/base.parser"),
]);
let passed = 0;

function ok(cond: unknown, label: string): void {
  assert.ok(cond, label);
  passed++;
}

console.log("1. Testing TempMailUtils:");
ok(
  extractOtpCode("Your verification code is 492810. Do not share it.") === "492810",
  "Should extract 6-digit verification code",
);
ok(
  extractOtpCode(
    "<style>p { color: #555555; font-size: 14px; }</style><p>Click this link: https://app.faceless.video/auth/confirm?token_hash=pkce_4a686446df7117ce7f7d25cd7c55edb230587c7c779ccdb04595105a&type=signup</p>",
  ) === null,
  "Should return null for magic link email without OTP",
);
ok(formatCountdown(125) === "02:05", "Should format 125 seconds to 02:05");
ok(formatCountdown(0) === "Expired", "Should report Expired for 0 seconds");
console.log("   ✓ TempMailUtils passed.");

console.log("\n2. Testing lib utilities:");
ok(
  escapeHtml('hello <world> & "quotes"') === "hello &lt;world&gt; &amp; &quot;quotes&quot;",
  "Should escape HTML",
);
ok(
  formatRelativeTime(new Date(Date.now() - 5000)) === "just now",
  "Should format recent time as just now",
);
ok(
  isContextInvalidated(new Error("Extension context invalidated.")) === true,
  "Should detect invalidated extension context",
);
ok(
  slugify("Testing AI Toolkit Architecture") === "testing-ai-toolkit-architecture",
  "Should slugify text",
);
ok(typeof setNativeValue === "function", "setNativeValue must be exported");
ok(DESIGN_TOKENS.primary === "#1A73E8", "DESIGN_TOKENS.primary should match theme");
ok(DESIGN_TOKENS.bg === "#EAEFF5", "DESIGN_TOKENS.bg should match theme");
ok(DESIGN_TOKENS.surface === "#FFFFFF", "DESIGN_TOKENS.surface should match theme");
console.log("   ✓ lib utilities passed.");
console.log("\n2.5. Testing Feature Module Colors & Registration:");
defineFeature({
  id: "test-module",
  name: "Test Module",
  description: "Test description",
  icon: "mail",
  color: "#FF4400",
});
ok(
  getFeatureColor("test-module") === "#FF4400",
  "Custom registered feature should report registered color",
);
ok(
  getFeatureColor("unknown-feature") === DESIGN_TOKENS.primary,
  "Unknown feature should fall back to the theme primary color",
);
ok(roleFromHints({ authorRole: "user" }, 1) === "user", "Role: explicit user attribute wins");
ok(
  roleFromHints({ authorRole: "assistant" }, 0) === "assistant",
  "Role: explicit assistant attribute wins over turn parity",
);
ok(
  roleFromHints({ className: "font-user-message text-base" }, 1) === "user",
  "Role: user class hint",
);
ok(
  roleFromHints({ className: "font-claude-message" }, 0) === "assistant",
  "Role: assistant class hint",
);
ok(
  roleFromHints({ className: "message-row" }, 3) === "assistant",
  "Role: 'message' must not match the 'me' hint",
);
ok(
  roleFromHints({ className: "email-thread" }, 0) === "user",
  "Role: 'email' must not match the 'ai' hint",
);
ok(roleFromHints({}, 0) === "user", "Role: first turn defaults to user");
ok(roleFromHints({}, 1) === "assistant", "Role: second turn defaults to assistant");
console.log("   ✓ Feature module colors passed.");
console.log("\n3. Testing ai-toolkit service functions:");
const sampleConvo = {
  id: "test_chat_1",
  title: "Testing AI Toolkit Architecture",
  platform: "chatgpt" as const,
  url: "https://chatgpt.com/c/12345",
  createdAt: 1720000000000,
  messages: [
    { id: "m1", role: "user" as const, content: "Hello AI assistant" },
    { id: "m2", role: "assistant" as const, content: "Hello human! How can I help you today?" },
  ],
  totalWords: 11,
};

const formattedPdf = formatConversation(sampleConvo, "pdf");
ok(formattedPdf.mimeType === "text/html", "PDF should map to text/html");
ok(formattedPdf.content.includes("window.print()"), "PDF content should trigger window.print()");

const generatedFilename = generateFilename(sampleConvo, ".md");
ok(
  generatedFilename.startsWith("chatgpt_testing-ai-toolkit-architecture_"),
  "Filename should start with platform + slugified title",
);
ok(generatedFilename.endsWith(".md"), "Filename should end with .md");

await clearHistory();
ok((await getHistory()).length === 0, "History should be empty after clear");

const transcript = formatMarkdown(sampleConvo);
await recordHistory(
  {
    id: "hist_1",
    title: sampleConvo.title,
    platform: "chatgpt",
    messageCount: 2,
    exportedAt: Date.now(),
    format: "markdown",
    url: sampleConvo.url,
  },
  transcript,
);
const hist = await getHistory();
ok(hist.length === 1, "History should contain one item");
ok(hist[0].title === sampleConvo.title, "History item title should match");
ok(hist[0].hasContent === true, "Index entry should flag that a blob exists");
ok(!("content" in hist[0]), "Index must never carry the transcript itself");
ok(
  (await readHistoryContent("hist_1")) === transcript,
  "Transcript blob should be readable from session storage",
);

sessionStore.clear();
ok(
  (await getHistory())[0].title === sampleConvo.title,
  "Index survives a restart (it lives in the persistent area)",
);
ok((await readHistoryContent("hist_1")) === null, "Transcript is unreadable after a restart");

await deleteHistoryItem("hist_1");
ok((await getHistory()).length === 0, "History should be empty after delete");
ok((await readHistoryContent("hist_1")) === null, "Deleting an entry should drop its blob");

fakeBrowser.storage.local.set({
  ai_toolkit_history: [
    {
      id: "hist_legacy",
      title: "Old export",
      platform: "chatgpt",
      messageCount: 1,
      exportedAt: 1,
      format: "markdown",
      url: "https://chatgpt.com/c/legacy",
      content: "legacy transcript",
    },
  ],
});
const migratedHistory = await getHistory();
ok(migratedHistory.length === 1, "Migration should keep the index entry");
ok(migratedHistory[0].hasContent === true, "Migrated entry should be flagged");
ok(!("content" in migratedHistory[0]), "Migration should strip the persisted transcript");
ok(
  (await readHistoryContent("hist_legacy")) === "legacy transcript",
  "Migration should move the transcript to session storage",
);
await clearHistory();

let cavemanSettings = await getCavemanSettings();
ok(cavemanSettings.enabled === false, "Caveman should default to disabled");
ok(cavemanSettings.level === "full", "Caveman should default to full level");

cavemanSettings = await updateCavemanSettings({ enabled: true, level: "ultra" });
ok(
  cavemanSettings.enabled === true && cavemanSettings.level === "ultra",
  "Caveman update should persist",
);

ok((await getCavemanSettings()).level === "ultra", "Caveman settings should survive across calls");
await assert.rejects(
  () => updateCavemanSettings({ level: "bogus" as never }),
  /Invalid caveman level/,
  "Invalid caveman level should be rejected",
);
console.log("   ✓ ai-toolkit service passed.");

console.log("\n4. Testing formatters:");
const mdOutput = formatMarkdown(sampleConvo);
ok(
  mdOutput.includes('title: "Testing AI Toolkit Architecture"'),
  "Markdown should include title frontmatter",
);
ok(mdOutput.includes("### 🧑 User"), "Markdown should include user role heading");
ok(mdOutput.includes("### 🤖 Assistant"), "Markdown should include assistant role heading");

const jsonOutput = formatJson(sampleConvo);
const parsedJson = JSON.parse(jsonOutput);
ok(parsedJson.version === "1.0", "JSON should include version");
ok(parsedJson.conversation.title === sampleConvo.title, "JSON should include conversation title");

const htmlOutput = formatHtml(sampleConvo);
ok(htmlOutput.includes("<!DOCTYPE html>"), "HTML should be a full document");
ok(htmlOutput.includes("Testing AI Toolkit Architecture"), "HTML should include title");

const printPdfOutput = formatHtml(sampleConvo, { autoPrint: true });
ok(printPdfOutput.includes("window.print()"), "Auto-print HTML should call window.print()");

const plainTextOutput = formatPlainText(sampleConvo);
ok(
  plainTextOutput.includes(sampleConvo.title.toUpperCase()),
  "Plain text should include uppercase title",
);
ok(plainTextOutput.includes("[USER]:"), "Plain text should include user prefix");
console.log("   ✓ Formatters passed.");

console.log("\n5. Testing ChatParserUtils platform detection:");
ok(detectPlatform("chatgpt.com") === "chatgpt", "Should detect ChatGPT");
ok(detectPlatform("claude.ai") === "claude", "Should detect Claude");
ok(detectPlatform("gemini.google.com") === "gemini", "Should detect Gemini");
ok(detectPlatform("chat.deepseek.com") === "deepseek", "Should detect DeepSeek");
ok(detectPlatform("example.com") === "generic", "Should fall back to generic");
console.log("   ✓ ChatParserUtils passed.");

console.log("\n6. Testing CavemanDirectiveUtils:");
ok(buildReminder("lite").includes("LITE"), "Lite reminder should mention LITE");
ok(buildReminder("full").includes("FULL"), "Full reminder should mention FULL");
ok(buildPrimer("ultra").includes("Intensity ULTRA"), "Ultra primer should mention ULTRA");

ok(isPrefixed("[Caveman mode is ON] Hello") === true, "Should detect primer prefix");
ok(isPrefixed("[stay in caveman mode — FULL] Hello") === true, "Should detect reminder prefix");
ok(isPrefixed("Hello world") === false, "Should not detect prefix on plain text");

ok(needsPrimer([]) === true, "Empty history requires primer");
ok(needsPrimer(null) === true, "Null history requires primer");
ok(
  needsPrimer([
    { role: "user", content: "Halo apa kabar" },
    { role: "assistant", content: "Kabar baik!" },
  ]) === true,
  "Ongoing chat with no caveman prefix must require primer",
);
ok(
  needsPrimer([
    { role: "user", content: "[Caveman mode is ON for this whole conversation...] Halo" },
    { role: "assistant", content: "Halo." },
  ]) === false,
  "Already-primed chat should not require primer",
);

const wrappedPrimer = wrapText("Explain recursion", true, "full");
ok(wrappedPrimer.startsWith("[Caveman mode is ON"), "wrapText(true) should prepend primer");
ok(wrappedPrimer.includes("Explain recursion"), "wrapText should keep original text");

const wrappedReminder = wrapText("Explain recursion", false, "full");
ok(
  wrappedReminder.startsWith("[stay in caveman mode — FULL]"),
  "wrapText(false) should prepend reminder",
);

const stopWrapped = wrapText("Explain recursion", false, "bogus" as never);
ok(stopWrapped.startsWith("[stop caveman mode"), "Unknown level must inject the stop directive");
ok(buildStop().includes("normal"), "Stop directive resumes normal replies");
ok(isPrefixed("[stop caveman mode] Please clarify") === true, "Should detect stop prefix");
ok(isStopPrefixed("[stop caveman mode] Please clarify") === true, "isStopPrefixed true");
ok(isStopPrefixed("normal text") === false, "isStopPrefixed false");

ok(
  hasStop([{ role: "user", content: "[stop caveman mode] Resume normal" }]) === true,
  "hasStop should find stop directive",
);
ok(
  hasStop([{ role: "user", content: "[stay in caveman mode — LITE]" }]) === false,
  "hasStop should ignore reminders",
);
const stopOff = wrapStop("Continue explaining");
ok(stopOff.startsWith("[stop caveman mode"), "wrapStop must prepend the stop directive");
ok(
  wrapStop("[stop caveman mode] already stopped") === "[stop caveman mode] already stopped",
  "wrapStop must be idempotent",
);
console.log("   ✓ CavemanDirectiveUtils passed.");

console.log("\n7. Testing TempMailService with live API (api.tempmail.ing):");
try {
  const email = await tempMail.generateEmail(60);
  ok(email.address.includes("@"), "Generated address should contain @");
  ok((await tempMail.hasValidEmail()) === true, "Should report valid email");
  const inbox = await tempMail.fetchInbox();
  ok(Array.isArray(inbox), "Inbox should return an array");
  console.log(`   Generated address: ${email.address}`);
  console.log(`   Inbox items: ${inbox.length}`);
  console.log("   ✓ TempMailService live API passed.");
} catch (err) {
  console.warn(`   ⚠ Live API test skipped (${err instanceof Error ? err.message : String(err)})`);
}

console.log("\n8. Testing theme contrast (light + dark):");
{
  const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
  const themeBlock = css.slice(css.indexOf("@theme"), css.indexOf(":host {"));
  const darkBlock = css.slice(css.indexOf("prefers-color-scheme: dark"));

  const tokenIn = (block: string, name: string): string | null =>
    block.match(new RegExp(`--color-ext-${name}:\\s*([^;]+);`))?.[1].trim() ?? null;

  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };

  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const PAIRS: [string, string][] = [
    ["text", "surface"],
    ["text", "bg"],
    ["text", "subtle"],
    ["text", "subtle-strong"],
    ["text-secondary", "surface"],
    ["text-secondary", "subtle"],
    ["muted", "surface"],
    ["muted", "bg"],
    ["muted", "subtle"],
    ["primary", "surface"],
    ["info-ink", "info-soft"],
    ["success-ink", "success-soft"],
    ["warning-ink", "warning-soft"],
    ["danger-ink", "danger-soft"],
  ];

  for (const theme of ["light", "dark"] as const) {
    for (const [fg, bg] of PAIRS) {
      const resolve = (name: string): string => {
        const value =
          (theme === "dark" ? tokenIn(darkBlock, name) : null) ?? tokenIn(themeBlock, name);
        assert.ok(value, `${theme}: token --color-ext-${name} is missing`);
        assert.ok(
          /^#[0-9a-f]{6}$/i.test(value),
          `${theme}: --color-ext-${name} must be a hex value`,
        );
        return value;
      };
      const ratio = contrast(resolve(fg), resolve(bg));
      assert.ok(
        ratio >= 4.5,
        `${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 — below the 4.5:1 minimum`,
      );
    }
  }

  assert.ok(
    tokenIn(darkBlock, "surface") !== tokenIn(themeBlock, "surface"),
    "Dark theme should override the surface token",
  );
  console.log(`   ✓ Theme contrast passed (${PAIRS.length} pairs × 2 themes).`);
}

console.log("\n9. Testing Security & Hardening Validations:");

type DomParserCtor = new () => { parseFromString: (markup: string, mime: string) => unknown };
let LinkedomParser: DomParserCtor | null = null;

class FragmentAwareDOMParser {
  parseFromString(html: string, mimeType: string): unknown {
    if (!LinkedomParser) throw new Error("no DOM parser available");
    const source = /<html[\s>]/i.test(html)
      ? html
      : `<!doctype html><html><body>${html}</body></html>`;
    return new LinkedomParser().parseFromString(source, mimeType);
  }
}

try {
  const linkedom = (await import("linkedom")) as { DOMParser: DomParserCtor };
  LinkedomParser = linkedom.DOMParser;
  (globalThis as Record<string, unknown>).DOMParser = FragmentAwareDOMParser;
  console.log("   · sanitizer exercised through DOMParser (the path browsers take)");
} catch {
  console.warn("   ⚠ linkedom unavailable — sanitizer assertions cover the fallback path only");
}

const dirtyHtml = `
  <div>
    <p>Safe paragraph <b>bold</b></p>
    <script>window.__pwned = true;</script>
    <img src="https://tracker.com/pixel.png" onerror="alert(1)">
    <a href="javascript:alert(2)">Click me</a>
    <iframe src="https://evil.com"></iframe>
  </div>
`;
const cleanHtml = sanitizeEmailHtml(dirtyHtml);
ok(!cleanHtml.includes("<script"), "Sanitizer must remove <script> tags");
ok(!cleanHtml.includes("onerror"), "Sanitizer must remove inline event handlers");
ok(!cleanHtml.includes("javascript:"), "Sanitizer must remove javascript: schemes");
ok(!cleanHtml.includes("<iframe"), "Sanitizer must remove <iframe> tags");
ok(
  cleanHtml.includes("Safe paragraph") && cleanHtml.includes("<b>bold</b>"),
  "Sanitizer must preserve safe markup",
);

const hardenedHtml = `
  <a href="https://example.com/a">safe link</a>
  <a href="ja&#118;ascript:alert(1)">entity encoded</a>
  <a href="java\tscript:alert(2)">tab smuggled</a>
  <img src="blob:https://evil.com/abc" srcset="data:image/png;base64,AAA 1x, javascript:alert(3) 2x">
  <video poster="filesystem:https://evil.com/temporary/x"></video>
`;
const hardened = sanitizeEmailHtml(hardenedHtml);
ok(!hardened.includes("alert(1)"), "Sanitizer must decode HTML entities before scheme checks");
ok(!hardened.includes("alert(2)"), "Sanitizer must ignore whitespace inside a scheme");
ok(!hardened.includes("blob:"), "Sanitizer must drop blob: URLs");
ok(!hardened.includes("filesystem:"), "Sanitizer must drop filesystem: URLs");
ok(!hardened.includes("alert(3)"), "Sanitizer must vet every srcset entry");
ok(
  hardened.includes('rel="noopener noreferrer nofollow"') && hardened.includes('target="_blank"'),
  "Surviving links must open without opener access",
);
ok(
  !hardened.includes("srcset") && hardened.includes("<img"),
  "A srcset with one dangerous entry is dropped whole, keeping the image tag itself",
);
ok(hardened.includes('href="https://example.com/a"'), "Safe links must survive the vetting");

await assert.rejects(
  () => gmSet("test-script-1", "big", "x".repeat(70 * 1024)),
  /limit is 64 KB/,
  "GM_setValue must reject values above the per-value ceiling",
);
ok((await gmGet("test-script-1", "small")) === undefined, "GM values start undefined");
await gmSet("test-script-1", "small", 42);
ok((await gmGet("test-script-1", "small")) === 42, "GM values round-trip");

ok(isPrivateOrLocalHost("localhost") === true, "localhost must be private");
ok(isPrivateOrLocalHost("127.0.0.1") === true, "127.0.0.1 must be private");
ok(isPrivateOrLocalHost("0.0.0.0") === true, "0.0.0.0 must be private");
ok(isPrivateOrLocalHost("169.254.169.254") === true, "169.254.169.254 must be private");
ok(isPrivateOrLocalHost("192.168.1.1") === true, "192.168.x.x must be private");
ok(isPrivateOrLocalHost("10.0.0.5") === true, "10.x.x.x must be private");
ok(isPrivateOrLocalHost("example.com") === false, "Public domain must not be private");
ok(isPrivateOrLocalHost("api.tempmail.ing") === false, "api.tempmail.ing must not be private");

await gmDelete("test-script-1", "small");
ok((await gmList("test-script-1")).length === 0, "GM delete must drop the key");

const token1 = getScriptToken("test-script-1");
const token2 = getScriptToken("test-script-1");
ok(token1 === token2, "getScriptToken must be idempotent for the same script");
ok(token1.startsWith("test-script-1_"), "Token must include script prefix");
const allTokens = getAllScriptTokens();
ok(allTokens["test-script-1"] === token1, "getAllScriptTokens must include registered token");

console.log("   ✓ Security & Hardening validations passed.");

console.log(`\n[Test] All ${passed} assertions passed. ✓`);
