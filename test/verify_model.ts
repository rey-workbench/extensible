import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import type { SettingField } from "@/lib/feature-registry";

console.log("[Test] Running WXT + Svelte Unit & Integration Tests...\n");

const sessionStore = new Map<string, unknown>();

function createFakeBrowser(): Record<string, unknown> {
  const listeners = new Set<(changes: unknown, area: string) => void>();
  const persistentStore = new Map<string, unknown>();

  const mkArea = (store: Map<string, unknown>, name: string) => {
    const areaListeners = new Set<(changes: unknown, area: string) => void>();
    return {
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
        for (const fn of areaListeners) fn(changes, name);
      },
      remove(keys: string | string[]): void {
        for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k);
      },
      clear(): void {
        store.clear();
      },
      onChanged: {
        addListener: (fn: (changes: unknown, area: string) => void): void => {
          areaListeners.add(fn);
        },
        removeListener: (fn: (changes: unknown, area: string) => void): void => {
          areaListeners.delete(fn);
        },
      },
    };
  };

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
  providerErrors,
  theme,
  youtubeUtils,
  youtubeService,
  { tempMailSettingsSchema },
  { aiToolkitSettingsSchema },
  { DEFAULT_TEMPMAIL_SETTINGS },
  { DEFAULT_CAVEMAN_SETTINGS },
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
  import("@/features/temp-mail/utils/provider-error.utils"),
  import("@/lib/theme"),
  import("@/features/youtube/utils/youtube.utils"),
  import("@/features/youtube/services/youtube.service"),
  import("@/features/temp-mail/settings"),
  import("@/features/ai-toolkit/settings"),
  import("@/features/temp-mail/constants/temp-mail.constants"),
  import("@/features/ai-toolkit/constants/ai-toolkit.constants"),
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
  const themeAware = css.slice(css.indexOf("@supports (color: light-dark"));

  const splitTopLevel = (value: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const char of value) {
      if (char === "(") depth++;
      else if (char === ")") depth--;
      else if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    parts.push(current);
    return parts.map((part) => part.trim());
  };

  const pairs = new Map<string, [string, string]>();
  for (const match of themeAware.matchAll(/--color-ext-([a-z0-9-]+):\s*light-dark\(/g)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let end = start;
    while (end < themeAware.length && depth > 0) {
      if (themeAware[end] === "(") depth++;
      else if (themeAware[end] === ")") depth--;
      end++;
    }
    const values = splitTopLevel(themeAware.slice(start, end - 1));
    if (values.length === 2) pairs.set(match[1], [values[0], values[1]]);
  }

  const themeTokens = [...themeBlock.matchAll(/--color-ext-([a-z0-9-]+):/g)].map((m) => m[1]);
  const withoutPair = themeTokens.filter((name) => !pairs.has(name));
  assert.ok(
    withoutPair.length === 0 && themeTokens.length > 0,
    `every colour token needs a light-dark() pair, missing: ${withoutPair.join(", ") || "none"}`,
  );

  for (const name of [...themeBlock.matchAll(/--shadow-ext-([a-z0-9-]+):/g)].map((m) => m[1])) {
    const at = themeAware.indexOf(`--shadow-ext-${name}:`);
    const declaration = themeAware.slice(at, themeAware.indexOf(";", at));
    assert.ok(
      at >= 0 && declaration.includes("light-dark("),
      `--shadow-ext-${name} must flip its colours between themes`,
    );
  }

  assert.ok(
    !/@media\s*\(prefers-color-scheme/.test(css),
    "the app must switch through color-scheme, not a second copy of the palette",
  );

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
        const pair = pairs.get(name);
        assert.ok(pair, `${theme}: token --color-ext-${name} is missing a theme pair`);
        const value = theme === "dark" ? pair[1] : pair[0];
        assert.ok(
          /^#[0-9a-f]{6}$/i.test(value),
          `${theme}: --color-ext-${name} must be a hex value (got ${value})`,
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
    pairs.get("surface")?.[0] !== pairs.get("surface")?.[1],
    "The two halves of a light-dark() pair must differ",
  );
  console.log(
    `   ✓ Theme contrast passed (${PAIRS.length} pairs \u00d7 2 themes, ${pairs.size} paired tokens).`,
  );
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

console.log("\n10. Testing provider failure handling (the Cloudflare 429 block):");
{
  const {
    TempMailApiError,
    cooldownFor,
    describeProviderFailure,
    formatCooldown,
    isCoolingDown,
    parseRetryAfter,
    readCloudflare,
    retryNoticeFrom,
    retryNoticeText,
  } = providerErrors;

  const cloudflarePage = `<!doctype html>
<html class="no-js" lang="en-US">
<head><title>Access denied | api.tempmail.ing used Cloudflare to restrict access</title>
<script>(function(){var a={event:"feedback clicked",properties:{errorCode: 1015 }};})();</script>
</head>
<body><h1><span data-translate="error">Error</span> <span>1015</span></h1>
<span>Ray ID: a3d39920abf9ce23 &bull;</span>
<h2>You are being rate limited</h2>
<p>The owner of this website (api.tempmail.ing) has banned you temporarily.</p></body></html>`;

  const cloudflare = readCloudflare(cloudflarePage);
  ok(cloudflare.code === 1015, "Cloudflare error code must be read from the body");
  ok(cloudflare.rayId === "a3d39920abf9ce23", "Cloudflare ray id must be read from the body");
  ok(
    cloudflare.reason === "You are being rate limited",
    "Cloudflare reason must be read from the h2",
  );

  const failure = describeProviderFailure({ status: 429, body: cloudflarePage });
  ok(failure.kind === "rate-limit", "A 429 must classify as rate-limit");
  ok(!/[<>]/.test(failure.message), "The user-facing message must never contain markup");
  ok(
    failure.message === "Temp mail provider is rate-limiting this network.",
    "A rate limit must produce one short sentence",
  );

  const blocked = describeProviderFailure({
    status: 403,
    body: "<script>errorCode: 1020</script>",
  });
  ok(blocked.kind === "blocked", "A firewall denial must classify as blocked, not rate-limit");
  ok(
    cooldownFor(blocked.kind, 1) > cooldownFor("rate-limit", 1),
    "A firewall block must wait longer than a rate limit",
  );
  ok(
    describeProviderFailure({ status: 404, body: "{}" }).kind === "not-found",
    "A 404 must be its own kind so an empty inbox is not a failure",
  );

  ok(parseRetryAfter("120") === 120_000, "Retry-After delta-seconds must be honoured");
  const stamp = Date.now();
  ok(
    Math.abs(parseRetryAfter(new Date(stamp + 90_000).toUTCString(), stamp) - 90_000) < 2000,
    "Retry-After HTTP dates must be honoured",
  );
  ok(parseRetryAfter("later, maybe", stamp) === 0, "An invalid Retry-After must not create a wait");

  ok(cooldownFor("rate-limit", 1) === 60_000, "First rate limit must wait a minute");
  ok(cooldownFor("rate-limit", 2) === 300_000, "A repeat must escalate to five minutes");
  ok(cooldownFor("rate-limit", 99) === 3_600_000, "The ladder must cap at an hour");
  ok(
    cooldownFor("rate-limit", 1, 2_000) === 2_000,
    "A provider Retry-After must win over the ladder",
  );
  ok(
    cooldownFor("rate-limit", 1, 99 * 3_600_000) === 3_600_000,
    "An absurd Retry-After must still be capped",
  );

  const notice = retryNoticeFrom(failure, null, stamp);
  ok(notice?.until === stamp + 60_000, "The notice must end when the cooldown does");
  ok(
    retryNoticeFrom(failure, notice, stamp)?.attempts === 2,
    "Consecutive same-kind failures must escalate",
  );
  ok(
    retryNoticeFrom(failure, { ...(notice ?? {}), kind: "server", attempts: 4 } as never, stamp)
      ?.attempts === 1,
    "A different failure kind must restart the ladder",
  );
  ok(
    retryNoticeFrom(
      { kind: "not-found", status: 404, message: "x", retryAfterMs: 0 },
      null,
      stamp,
    ) === null,
    "A 404 must not create a cooldown",
  );
  ok(
    retryNoticeText(notice as never, stamp) ===
      "Temp mail provider is rate-limiting this network. Retry in 1m.",
    "The notice text must state what happened and when to retry",
  );
  ok(
    formatCooldown(45_000) === "45s" &&
      formatCooldown(120_000) === "2m" &&
      formatCooldown(200_000) === "3m 20s",
    "Cooldown copy must stay short",
  );
  ok(
    isCoolingDown(notice, stamp) && !isCoolingDown(notice, stamp + 60_001),
    "A cooldown must expire on its own",
  );

  fakeBrowser.storage.local.remove("local:temp_mail:retry");
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls++;
    return Promise.resolve(
      new Response(cloudflarePage, {
        status: 429,
        headers: { "content-type": "text/html" },
      }),
    );
  }) as typeof fetch;
  try {
    let thrown: unknown = null;
    try {
      await tempMail.generateEmail(60);
    } catch (err) {
      thrown = err;
    }
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    ok(thrown instanceof TempMailApiError, "The service must throw a classified error");
    ok(!/<!doctype|<html/i.test(message), "The Cloudflare page must never leak into the message");
    ok(/Retry in/.test(message), "The error must tell the user when to retry");
    ok(calls === 1, "The failing request must touch the network exactly once");

    const secondMessage = await tempMail.generateEmail(60).then(
      () => "",
      (err: unknown) => (err instanceof Error ? err.message : String(err)),
    );
    ok(calls === 1, "A cooldown must block the next call without any network hit");
    ok(/rate-limiting/.test(secondMessage), "The blocked call must explain itself");
    ok(
      (await tempMail.getRetryNotice())?.kind === "rate-limit",
      "The cooldown must be persisted so every surface sees it",
    );
  } finally {
    globalThis.fetch = realFetch;
    fakeBrowser.storage.local.remove("local:temp_mail:retry");
  }
  console.log("   ✓ Provider failure handling passed.");
}

console.log("\n11. Testing theme switching (system / light / dark):");
{
  const {
    applyTheme,
    bindTheme,
    colorSchemeFor,
    getThemePreference,
    nextTheme,
    setThemePreference,
    supportsTheming,
  } = theme;

  ok(colorSchemeFor("system") === "light dark", "System must delegate to the browser");
  ok(colorSchemeFor("light") === "light", "The light preference must pin light");
  ok(colorSchemeFor("dark") === "dark", "The dark preference must pin dark");
  ok(
    nextTheme("system") === "light" &&
      nextTheme("light") === "dark" &&
      nextTheme("dark") === "system",
    "The header button must cycle system → light → dark → system",
  );
  ok(nextTheme("nonsense" as never) === "system", "An unknown stored value must restart at system");

  const globalObject = globalThis as Record<string, unknown>;
  const realCss = globalObject.CSS;
  globalObject.CSS = { supports: () => true };
  ok(supportsTheming(), "light-dark() support must be detected");

  const fakeRoot = () =>
    ({ style: {} as CSSStyleDeclaration, isConnected: true }) as unknown as HTMLElement;

  const darkRoot = fakeRoot();
  applyTheme(darkRoot, "dark");
  ok(darkRoot.style.colorScheme === "dark", "An explicit dark choice must pin the scheme");
  const autoRoot = fakeRoot();
  applyTheme(autoRoot, "system");
  ok(autoRoot.style.colorScheme === "light dark", "System must leave the decision to the OS, live");

  await setThemePreference("light");
  ok((await getThemePreference()) === "light", "The preference must survive a reload");
  const host = fakeRoot();
  bindTheme(host);
  ok(
    host.style.colorScheme === "light dark",
    "A bound host must be themed from the very first frame, before the read lands",
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  ok(host.style.colorScheme === "light", "bindTheme must apply the value already stored");

  await setThemePreference("dark");
  await new Promise((resolve) => setTimeout(resolve, 0));
  ok(
    host.style.colorScheme === "dark",
    "A stored change must re-theme hosts that are already bound (dock, badges, composer)",
  );

  globalObject.CSS = { supports: () => false };
  const oldBrowser = fakeRoot();
  applyTheme(oldBrowser, "dark");
  ok(
    !oldBrowser.style.colorScheme,
    "Without light-dark() the app must stay light rather than half broken",
  );

  globalObject.CSS = realCss;
  await setThemePreference("system");
  console.log("   ✓ Theme switching passed.");
}

console.log("\n12. Testing YouTube link parsing:");
{
  const { embedUrl, oembedUrl, parseStartSeconds, parseVideoId, thumbnailUrl, toEntry, watchUrl } =
    youtubeUtils;

  const ID = "dQw4w9WgXcQ";
  const forms = [
    [ID, "bare id"],
    [`https://www.youtube.com/watch?v=${ID}`, "watch url"],
    [`https://www.youtube.com/watch?v=${ID}&list=PL123&index=4`, "watch url with playlist"],
    [`https://youtu.be/${ID}?t=90`, "short link with timestamp"],
    [`https://youtu.be/${ID}`, "short link"],
    [`https://m.youtube.com/watch?v=${ID}`, "mobile host"],
    [`https://music.youtube.com/watch?v=${ID}`, "music host"],
    [`https://www.youtube.com/shorts/${ID}`, "shorts"],
    [`https://www.youtube.com/embed/${ID}?rel=0`, "embed"],
    [`https://www.youtube.com/live/${ID}`, "live"],
    [`https://www.youtube-nocookie.com/embed/${ID}`, "nocookie embed"],
    [`youtube.com/watch?v=${ID}`, "url without scheme"],
  ] as const;
  for (const [value, label] of forms) {
    ok(parseVideoId(value) === ID, `Should parse ${label}`);
  }

  const rejects = [
    "",
    "hello world",
    `https://vimeo.com/${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    "https://www.youtube.com/watch?v=tooshort",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/results?search_query=lofi",
  ];
  for (const value of rejects) {
    ok(parseVideoId(value) === null, `Should reject "${value.slice(0, 42)}"`);
  }

  ok(parseStartSeconds(`https://youtu.be/${ID}?t=90`) === 90, "?t= seconds");
  ok(parseStartSeconds(`https://www.youtube.com/watch?v=${ID}&t=1m30s`) === 90, "?t= h/m/s form");
  ok(parseStartSeconds(`https://youtu.be/${ID}#t=45s`) === 45, "#t= seconds form");
  ok(parseStartSeconds(`https://www.youtube.com/watch?v=${ID}&start=120`) === 120, "start= param");
  ok(parseStartSeconds(ID) === null, "A bare id has no start offset");
  ok(parseStartSeconds(`https://youtu.be/${ID}?t=0`) === null, "A zero offset is the same as none");

  ok(watchUrl(ID) === `https://www.youtube.com/watch?v=${ID}`, "watch url is built from constants");
  ok(watchUrl(ID, 90).endsWith("&t=90"), "watch url keeps the start offset");
  ok(thumbnailUrl(ID).endsWith(`/vi/${ID}/hqdefault.jpg`), "thumbnail url shape");
  ok(
    embedUrl(ID).includes(`/embed/${ID}?`) && embedUrl(ID).includes("rel=0"),
    "embed url must disable related videos",
  );
  ok(embedUrl(ID, { start: 30 }).includes("start=30"), "embed url carries the start offset");
  ok(
    !embedUrl(ID).includes("origin="),
    "Without an origin the player gets no referrer from the page",
  );
  ok(
    oembedUrl(ID).startsWith("https://www.youtube.com/oembed?url=https%3A%2F%2F"),
    "oembed must encode the watch url",
  );

  const entry = toEntry(ID);
  ok(entry.title === ID, "A missing title falls back to the id so the list stays readable");
  ok(entry.author === "", "A missing author is empty, not undefined");
  ok(toEntry(ID, "  Song  ", "  Channel ").title === "Song", "Titles are trimmed");
  ok(toEntry(ID, "", "X").title === ID, "A blank title falls back to the id");

  console.log("   ✓ YouTube link parsing passed.");
}

console.log("\n13. Testing YouTube oEmbed resolve (live):");
try {
  const resolved = await youtubeService.resolveVideo("dQw4w9WgXcQ");
  ok(
    resolved.title.length > 0 && resolved.title !== "dQw4w9WgXcQ",
    "A real video must come back with its title",
  );
  ok(resolved.author.length > 0, "A real video must come back with its channel");
  console.log(`   Resolved: ${resolved.title} — ${resolved.author}`);
  const fallback = await youtubeService.resolveVideo("aaaaaaaaaaa");
  ok(fallback.id === "aaaaaaaaaaa", "An unknown id must still return a playable entry");
  console.log("   ✓ YouTube oEmbed resolve passed.");
} catch (err) {
  console.warn(
    `   ⚠ Live oEmbed test skipped (${err instanceof Error ? err.message : String(err)})`,
  );
}

console.log("\n15. Testing floating player geometry:");
{
  const viewport = { width: 1440, height: 900 };
  const inside = (g: { x: number; y: number; width: number; height: number }, v = viewport) =>
    g.x >= 0 && g.y >= 0 && g.x + g.width <= v.width && g.y + g.height <= v.height;

  const fresh = youtubeUtils.readPlayerGeometry(null, viewport);
  ok(inside(fresh), "A fresh player must open fully inside the viewport");
  ok(
    fresh.x > viewport.width / 2 && fresh.y > viewport.height / 2,
    "A fresh player must open in the bottom-right corner, not over the hub",
  );
  ok(fresh.width >= 260 && fresh.height >= 180, "A fresh player must respect the minimum size");

  const junk = ["nope", 42, { x: "10" }, { x: 1, y: 2 }, {}];
  for (const raw of junk) {
    const g = youtubeUtils.readPlayerGeometry(raw, viewport);
    ok(inside(g), `Junk geometry (${JSON.stringify(raw)}) must fall back to a usable window`);
  }

  const draggedOffTop = youtubeUtils.clampPlayerGeometry(
    { x: -400, y: -300, width: 420, height: 280 },
    viewport,
  );
  ok(draggedOffTop.x === 0 && draggedOffTop.y === 0, "A window dragged past the edge snaps back");
  ok(inside(draggedOffTop), "A clamped window stays reachable");

  const draggedOffRight = youtubeUtils.clampPlayerGeometry(
    { x: 1400, y: 880, width: 420, height: 280 },
    viewport,
  );
  ok(inside(draggedOffRight), "A window dragged past the far edge stays inside");

  const tiny = youtubeUtils.clampPlayerGeometry({ x: 10, y: 10, width: 20, height: 20 }, viewport);
  ok(
    tiny.width === 260 && tiny.height === 180,
    "A window resized to nothing grows back to the minimum",
  );

  const huge = youtubeUtils.clampPlayerGeometry(
    { x: 0, y: 0, width: 5000, height: 5000 },
    viewport,
  );
  ok(inside(huge), "A window larger than the screen is clamped to it");

  const unmeasured = youtubeUtils.defaultPlayerGeometry({ width: 0, height: 0 });
  ok(
    unmeasured.x >= 0 && unmeasured.y >= 0,
    "An unmeasured viewport must not push the window negative",
  );
  const clampedFromZero = youtubeUtils.clampPlayerGeometry(
    { x: 5, y: 5, width: 100, height: 100 },
    { width: 0, height: 0 },
  );
  ok(
    clampedFromZero.x === 0 && clampedFromZero.y === 0,
    "A zero viewport clamps the position to 0,0",
  );

  const phone = { width: 360, height: 640 };
  const small = youtubeUtils.defaultPlayerGeometry(phone);
  ok(
    small.width >= 260 && small.width <= phone.width,
    `The default width must fit a phone viewport (got ${small.width})`,
  );
  ok(inside(small, phone), "A phone-sized viewport still gets a fully visible window");

  await youtubeService.savePlayerGeometry({ x: 40, y: 60, width: 500, height: 320 });
  const restored = await youtubeService.getPlayerGeometry(viewport);
  ok(
    restored.x === 40 && restored.y === 60 && restored.width === 500 && restored.height === 320,
    "A saved position must come back unchanged when it still fits",
  );
  const fromOtherScreen = await youtubeService.getPlayerGeometry({ width: 300, height: 400 });
  ok(
    inside(fromOtherScreen, { width: 300, height: 400 }),
    "A position saved on a big screen must be pulled back onto a small one",
  );

  ok(
    youtubeUtils.embedOrigin("chrome-extension://abc/popup.html") === "chrome-extension://abc",
    "The popup may tell YouTube its own origin",
  );
  ok(
    youtubeUtils.embedOrigin("https://mail.example.com/inbox") === "",
    "A content script must not hand the page origin to YouTube",
  );
  ok(youtubeUtils.embedOrigin(undefined) === "", "A missing location yields no origin");

  console.log("   ✓ Floating player geometry passed.");
}

console.log("\n14. Testing module settings schemas:");
{
  function changedValues(fields: SettingField[]): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.kind === "toggle") patch[field.key] = false;
      else if (field.kind === "select") patch[field.key] = field.options.at(-1)?.value ?? "";
      else patch[field.key] = 1;
    }
    return patch;
  }

  const cases = [
    { id: "temp-mail", schema: tempMailSettingsSchema, defaults: { ...DEFAULT_TEMPMAIL_SETTINGS } },
    {
      id: "ai-toolkit",
      schema: aiToolkitSettingsSchema,
      defaults: { ...DEFAULT_CAVEMAN_SETTINGS },
    },
  ];

  const NOT_EXPOSED: Record<string, string[]> = { "ai-toolkit": ["sites"] };

  for (const { id, schema, defaults } of cases) {
    const keys = schema.fields.map((f) => f.key);
    ok(new Set(keys).size === keys.length, `${id}: setting keys must be unique`);
    ok(schema.fields.length > 0, `${id}: a declared schema must have at least one field`);

    for (const field of schema.fields) {
      ok(
        Object.hasOwn(defaults, field.key),
        `${id}: unknown setting key "${field.key}" — declared fields must exist in the stored record`,
      );
      ok(field.label.length > 0, `${id}: "${field.key}" needs a label`);
      ok(
        ["toggle", "select", "number"].includes(field.kind),
        `${id}: "${field.key}" uses unsupported kind "${field.kind}"`,
      );
      if (field.kind === "select") {
        const values = (field.options ?? []).map((o) => o.value);
        ok(values.length > 1, `${id}: "${field.key}" select needs options`);
        ok(new Set(values).size === values.length, `${id}: "${field.key}" options must be unique`);
      }
    }

    const hidden = NOT_EXPOSED[id] ?? [];
    const uncovered = Object.keys(defaults).filter((k) => !keys.includes(k) && !hidden.includes(k));
    ok(
      uncovered.length === 0,
      `${id}: stored settings ${uncovered.join(", ")} are neither in the UI nor listed as intentionally hidden`,
    );

    const current = await schema.read();
    for (const key of keys) {
      assert.ok(key in current, `${id}: read() must return "${key}"`);
    }

    const next = await schema.write(changedValues(schema.fields));
    for (const key of keys) {
      assert.ok(key in next, `${id}: write() must return "${key}"`);
    }
    const reloaded = await schema.read();
    for (const key of keys) {
      assert.ok(
        JSON.stringify(reloaded[key]) === JSON.stringify(next[key]),
        `${id}: write("${key}") must persist`,
      );
    }
  }

  const cavemanPreserved = await aiToolkitSettingsSchema.write({ level: "ultra" });
  ok(cavemanPreserved.level === "ultra", "ai-toolkit: level patches must round-trip");
  ok(
    JSON.stringify(cavemanPreserved.sites) === JSON.stringify(DEFAULT_CAVEMAN_SETTINGS.sites),
    "ai-toolkit: patching one field must not drop per-site overrides",
  );
  let rejected = false;
  try {
    await aiToolkitSettingsSchema.write({ level: "nope" });
  } catch {
    rejected = true;
  }
  ok(rejected, "ai-toolkit: an invalid select value must be rejected, not stored");

  const badgeOff = await tempMailSettingsSchema.write({ showFloatingButton: false });
  ok(badgeOff.showFloatingButton === false, "temp-mail: the badge toggle must persist");
  await tempMailSettingsSchema.write({ showFloatingButton: true });

  const renderer = readFileSync("src/components/ModuleSettings.svelte", "utf8");
  for (const kind of ["toggle", "select", "number"]) {
    ok(renderer.includes(`"${kind}"`), `ModuleSettings must render the "${kind}" field kind`);
  }
  ok(
    !existsSync("src/features/ai-toolkit/components/CavemanCard.svelte"),
    "Caveman settings must come from the shared screen, not a hand-built card",
  );

  console.log(`   ✓ Settings schemas passed (${cases.length} modules).`);
}

console.log(`\n[Test] All ${passed} assertions passed. ✓`);
