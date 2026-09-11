import assert from "node:assert";

console.log("[Test] Running WXT + Svelte Unit & Integration Tests...\n");

// ── Fake browser (WXT storage reads `globalThis.browser` at import time) ──
function createFakeBrowser(): Record<string, unknown> {
  const store = new Map<string, unknown>();
  const listeners = new Set<(changes: unknown, area: string) => void>();

  const area = {
    get(
      keys: string | string[] | Record<string, unknown> | null | undefined
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
      for (const fn of listeners) fn(changes, "local");
    },
    remove(keys: string | string[]): void {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
    },
    clear(): void {
      store.clear();
    },
  };

  return {
    runtime: { id: "test-extension" },
    storage: {
      local: area,
      sync: area,
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  };
}

(globalThis as Record<string, unknown>).browser = createFakeBrowser();

// Modules must be imported AFTER the fake browser is installed.
const [
  { TempMailUtils },
  { escapeHtml, formatRelativeTime, isContextInvalidated, slugify },
  { AiToolkitService },
  { ChatParserUtils },
  { CavemanDirectiveUtils },
  { HtmlFormatterUtils, JsonFormatterUtils, MarkdownFormatterUtils },
  tempMail,
  { defineFeature, getFeatureColor },
] = await Promise.all([
  import("@/features/temp-mail/utils/temp-mail.utils"),
  import("@/lib/browser"),
  import("@/features/ai-toolkit/services/ai-toolkit.service"),
  import("@/features/ai-toolkit/utils/chat-parser.utils"),
  import("@/features/ai-toolkit/utils/caveman-directive.utils"),
  import("@/features/ai-toolkit/utils/index"),
  import("@/features/temp-mail/services/temp-mail.service"),
  import("@/lib/feature-registry"),
]);
let passed = 0;

function ok(cond: unknown, label: string): void {
  assert.ok(cond, label);
  passed++;
}

// 1. TempMail domain utilities
console.log("1. Testing TempMailUtils:");
ok(
  TempMailUtils.extractOtpCode("Your verification code is 492810. Do not share it.") === "492810",
  "Should extract 6-digit verification code"
);
ok(
  TempMailUtils.extractOtpCode(
    "<style>p { color: #555555; font-size: 14px; }</style><p>Click this link: https://app.faceless.video/auth/confirm?token_hash=pkce_4a686446df7117ce7f7d25cd7c55edb230587c7c779ccdb04595105a&type=signup</p>"
  ) === null,
  "Should return null for magic link email without OTP"
);
ok(TempMailUtils.formatCountdown(125) === "02:05", "Should format 125 seconds to 02:05");
ok(TempMailUtils.formatCountdown(0) === "Expired", "Should report Expired for 0 seconds");
console.log("   ✓ TempMailUtils passed.");

// 2. Shared browser/lib utilities
console.log("\n2. Testing lib utilities:");
ok(
  escapeHtml('hello <world> & "quotes"') === "hello &lt;world&gt; &amp; &quot;quotes&quot;",
  "Should escape HTML"
);
ok(
  formatRelativeTime(new Date(Date.now() - 5000)) === "just now",
  "Should format recent time as just now"
);
ok(
  isContextInvalidated(new Error("Extension context invalidated.")) === true,
  "Should detect invalidated extension context"
);
ok(
  slugify("Testing AI Toolkit Architecture") === "testing-ai-toolkit-architecture",
  "Should slugify text"
);
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
  "Custom registered feature should report registered color"
);
ok(
  getFeatureColor("unknown-feature") === "#1B4DDB",
  "Unknown feature should fall back to default color #1B4DDB"
);
console.log("   ✓ Feature module colors passed.");
console.log("\n3. Testing AiToolkitService:");
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

const service = new AiToolkitService();

const formattedPdf = service.formatConversation(sampleConvo, "pdf");
ok(formattedPdf.mimeType === "text/html", "PDF should map to text/html");
ok(formattedPdf.content.includes("window.print()"), "PDF content should trigger window.print()");

const generatedFilename = service.generateFilename(sampleConvo, ".md");
ok(
  generatedFilename.startsWith("chatgpt_testing-ai-toolkit-architecture_"),
  "Filename should start with platform + slugified title"
);
ok(generatedFilename.endsWith(".md"), "Filename should end with .md");

await service.clearHistory();
ok((await service.getHistory()).length === 0, "History should be empty after clear");

await service.recordHistory({
  id: "hist_1",
  title: sampleConvo.title,
  platform: "chatgpt",
  messageCount: 2,
  exportedAt: Date.now(),
  format: "markdown",
  url: sampleConvo.url,
  content: MarkdownFormatterUtils.format(sampleConvo),
});
const hist = await service.getHistory();
ok(hist.length === 1, "History should contain one item");
ok(hist[0].title === sampleConvo.title, "History item title should match");

await service.deleteHistoryItem("hist_1");
ok((await service.getHistory()).length === 0, "History should be empty after delete");

let cavemanSettings = await service.getCavemanSettings();
ok(cavemanSettings.enabled === false, "Caveman should default to disabled");
ok(cavemanSettings.level === "full", "Caveman should default to full level");

cavemanSettings = await service.updateCavemanSettings({ enabled: true, level: "ultra" });
ok(
  cavemanSettings.enabled === true && cavemanSettings.level === "ultra",
  "Caveman update should persist"
);

ok(
  (await service.getCavemanSettings()).level === "ultra",
  "Caveman settings should survive across calls"
);
await assert.rejects(
  () => service.updateCavemanSettings({ level: "bogus" as never }),
  /Invalid caveman level/,
  "Invalid caveman level should be rejected"
);
console.log("   ✓ AiToolkitService passed.");

// 4. Formatters
console.log("\n4. Testing formatters:");
const mdOutput = MarkdownFormatterUtils.format(sampleConvo);
ok(
  mdOutput.includes('title: "Testing AI Toolkit Architecture"'),
  "Markdown should include title frontmatter"
);
ok(mdOutput.includes("### 🧑 User"), "Markdown should include user role heading");
ok(mdOutput.includes("### 🤖 Assistant"), "Markdown should include assistant role heading");

const jsonOutput = JsonFormatterUtils.format(sampleConvo);
const parsedJson = JSON.parse(jsonOutput);
ok(parsedJson.version === "1.0", "JSON should include version");
ok(parsedJson.conversation.title === sampleConvo.title, "JSON should include conversation title");

const htmlOutput = HtmlFormatterUtils.format(sampleConvo);
ok(htmlOutput.includes("<!DOCTYPE html>"), "HTML should be a full document");
ok(htmlOutput.includes("Testing AI Toolkit Architecture"), "HTML should include title");

const printPdfOutput = HtmlFormatterUtils.format(sampleConvo, { autoPrint: true });
ok(printPdfOutput.includes("window.print()"), "Auto-print HTML should call window.print()");
console.log("   ✓ Formatters passed.");

// 5. Chat parser platform detection
console.log("\n5. Testing ChatParserUtils platform detection:");
ok(ChatParserUtils.detectPlatform("chatgpt.com") === "chatgpt", "Should detect ChatGPT");
ok(ChatParserUtils.detectPlatform("claude.ai") === "claude", "Should detect Claude");
ok(ChatParserUtils.detectPlatform("gemini.google.com") === "gemini", "Should detect Gemini");
ok(ChatParserUtils.detectPlatform("chat.deepseek.com") === "deepseek", "Should detect DeepSeek");
ok(ChatParserUtils.detectPlatform("example.com") === "generic", "Should fall back to generic");
console.log("   ✓ ChatParserUtils passed.");

// 6. Caveman directive builders
console.log("\n6. Testing CavemanDirectiveUtils:");
ok(
  CavemanDirectiveUtils.buildReminder("lite").includes("LITE"),
  "Lite reminder should mention LITE"
);
ok(
  CavemanDirectiveUtils.buildReminder("full").includes("FULL"),
  "Full reminder should mention FULL"
);
ok(
  CavemanDirectiveUtils.buildPrimer("ultra").includes("Intensity ULTRA"),
  "Ultra primer should mention ULTRA"
);

ok(
  CavemanDirectiveUtils.isPrefixed("[Caveman mode is ON] Hello") === true,
  "Should detect primer prefix"
);
ok(
  CavemanDirectiveUtils.isPrefixed("[stay in caveman mode — FULL] Hello") === true,
  "Should detect reminder prefix"
);
ok(
  CavemanDirectiveUtils.isPrefixed("Hello world") === false,
  "Should not detect prefix on plain text"
);

ok(CavemanDirectiveUtils.needsPrimer([]) === true, "Empty history requires primer");
ok(CavemanDirectiveUtils.needsPrimer(null) === true, "Null history requires primer");
ok(
  CavemanDirectiveUtils.needsPrimer([
    { role: "user", content: "Halo apa kabar" },
    { role: "assistant", content: "Kabar baik!" },
  ]) === true,
  "Ongoing chat with no caveman prefix must require primer"
);
ok(
  CavemanDirectiveUtils.needsPrimer([
    { role: "user", content: "[Caveman mode is ON for this whole conversation...] Halo" },
    { role: "assistant", content: "Halo." },
  ]) === false,
  "Already-primed chat should not require primer"
);

const wrappedPrimer = CavemanDirectiveUtils.wrapText("Explain recursion", true, "full");
ok(wrappedPrimer.startsWith("[Caveman mode is ON"), "wrapText(true) should prepend primer");
ok(wrappedPrimer.includes("Explain recursion"), "wrapText should keep original text");

const wrappedReminder = CavemanDirectiveUtils.wrapText("Explain recursion", false, "full");
ok(
  wrappedReminder.startsWith("[stay in caveman mode — FULL]"),
  "wrapText(false) should prepend reminder"
);

const stopWrapped = CavemanDirectiveUtils.wrapText("Explain recursion", false, "bogus" as never);
ok(stopWrapped.startsWith("[stop caveman mode"), "Unknown level must inject the stop directive");
ok(CavemanDirectiveUtils.buildStop().includes("normal"), "Stop directive resumes normal replies");
ok(
  CavemanDirectiveUtils.isPrefixed("[stop caveman mode] Please clarify") === true,
  "Should detect stop prefix"
);
ok(
  CavemanDirectiveUtils.isStopPrefixed("[stop caveman mode] Please clarify") === true,
  "isStopPrefixed true"
);
ok(CavemanDirectiveUtils.isStopPrefixed("normal text") === false, "isStopPrefixed false");

ok(
  CavemanDirectiveUtils.hasStop([
    { role: "user", content: "[stop caveman mode] Resume normal" },
  ]) === true,
  "hasStop should find stop directive"
);
ok(
  CavemanDirectiveUtils.hasStop([{ role: "user", content: "[stay in caveman mode — LITE]" }]) ===
    false,
  "hasStop should ignore reminders"
);
const stopOff = CavemanDirectiveUtils.wrapStop("Continue explaining");
ok(stopOff.startsWith("[stop caveman mode"), "wrapStop must prepend the stop directive");
ok(
  CavemanDirectiveUtils.wrapStop("[stop caveman mode] already stopped") ===
    "[stop caveman mode] already stopped",
  "wrapStop must be idempotent"
);
console.log("   ✓ CavemanDirectiveUtils passed.");

// 7. TempMail service (live API — skipped gracefully when offline)
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

console.log(`\n[Test] All ${passed} assertions passed. ✓`);
