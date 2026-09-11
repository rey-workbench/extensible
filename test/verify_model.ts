import assert from "node:assert";

console.log("[Test] Running WXT + Svelte Unit & Integration Tests...\n");

function createFakeBrowser(): Record<string, unknown> {
  const store = new Map<string, unknown>();
  const listeners = new Set<(changes: unknown, area: string) => void>();

  const area = {
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

const [
  { extractOtpCode, formatCountdown, sanitizeEmailHtml },
  { escapeHtml, formatRelativeTime, isContextInvalidated, slugify, setInputValue, setNativeValue },
  { AiToolkitService },
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
  { GmRpcService },
  { UserScriptsService },
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
ok(typeof setInputValue === "function", "setInputValue must be exported");
ok(typeof setNativeValue === "function", "setNativeValue must be exported");
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
  getFeatureColor("unknown-feature") === "#1B4DDB",
  "Unknown feature should fall back to default color #1B4DDB",
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
  "Filename should start with platform + slugified title",
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
  content: formatMarkdown(sampleConvo),
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
  "Caveman update should persist",
);

ok(
  (await service.getCavemanSettings()).level === "ultra",
  "Caveman settings should survive across calls",
);
await assert.rejects(
  () => service.updateCavemanSettings({ level: "bogus" as never }),
  /Invalid caveman level/,
  "Invalid caveman level should be rejected",
);
console.log("   ✓ AiToolkitService passed.");

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

console.log("\n8. Testing Security & Hardening Validations:");

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

ok(GmRpcService.isPrivateOrLocalHost("localhost") === true, "localhost must be private");
ok(GmRpcService.isPrivateOrLocalHost("127.0.0.1") === true, "127.0.0.1 must be private");
ok(GmRpcService.isPrivateOrLocalHost("0.0.0.0") === true, "0.0.0.0 must be private");
ok(
  GmRpcService.isPrivateOrLocalHost("169.254.169.254") === true,
  "169.254.169.254 must be private",
);
ok(GmRpcService.isPrivateOrLocalHost("192.168.1.1") === true, "192.168.x.x must be private");
ok(GmRpcService.isPrivateOrLocalHost("10.0.0.5") === true, "10.x.x.x must be private");
ok(GmRpcService.isPrivateOrLocalHost("example.com") === false, "Public domain must not be private");
ok(
  GmRpcService.isPrivateOrLocalHost("api.tempmail.ing") === false,
  "api.tempmail.ing must not be private",
);

const token1 = UserScriptsService.getScriptToken("test-script-1");
const token2 = UserScriptsService.getScriptToken("test-script-1");
ok(token1 === token2, "getScriptToken must be idempotent for the same script");
ok(token1.startsWith("test-script-1_"), "Token must include script prefix");
const allTokens = UserScriptsService.getAllScriptTokens();
ok(allTokens["test-script-1"] === token1, "getAllScriptTokens must include registered token");

console.log("   ✓ Security & Hardening validations passed.");

console.log(`\n[Test] All ${passed} assertions passed. ✓`);
