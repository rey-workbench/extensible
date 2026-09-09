import assert from "node:assert";
import {
  Container,
  ExtensionUtils,
  escapeHtml,
  StorageService,
  StringUtils,
  TimeUtils,
} from "@/core/index";
import {
  AiExporterModule,
  AiExporterService,
  CavemanDirectiveUtils,
  ChatParserUtils,
  ExportChatDto,
  HtmlFormatterUtils,
  JsonFormatterUtils,
  MarkdownFormatterUtils,
} from "@/modules/ai-exporter/index";
import { CreateTempMailDto } from "@/modules/temp-mail/dto/create-temp-mail.dto";
import { TempMailModule } from "@/modules/temp-mail/temp-mail.module";
import { TempMailService } from "@/modules/temp-mail/temp-mail.service";
import { TempMailUtils } from "@/modules/temp-mail/utils/index";
import {
  renderBadge,
  renderButton,
  renderCopyInput,
  renderEmptyState,
  renderIconButton,
  renderModal,
  renderStatusIndicator,
} from "@/shared/index";

console.log("[Test] Running NestJS TypeScript Unit & Integration Tests...\n");

// 1. Test DI Container & Module Resolution
console.log("1. Testing NestJS Container & Module Resolution:");
const container = new Container();
await container.registerModule(TempMailModule, { context: "background" });
await container.registerModule(AiExporterModule, { context: "background" });
await container.init();

const tempMailService = container.get<TempMailService>(TempMailService);
assert.ok(tempMailService instanceof TempMailService, "Should resolve TempMailService singleton");
const storage = container.get<StorageService>(StorageService);
assert.ok(storage instanceof StorageService, "Should resolve injected StorageService");

// Test 1b: Order-independent provider resolution & circular dependency detection
class DepB {
  val = "B";
}
class DepA {
  static inject = [DepB];
  constructor(public b: DepB) {}
}
const testContainer = new Container();
await testContainer.registerModule({
  id: "test-order",
  name: "Test Order",
  providers: [DepA, DepB], // DepA listed before DepB
});
const resolvedA = testContainer.get<DepA>(DepA);
assert.strictEqual(
  resolvedA.b.val,
  "B",
  "Should resolve DepA injecting DepB regardless of declaration order"
);

class CycleA {
  static inject = ["CycleB"];
}
class CycleB {
  static inject = ["CycleA"];
}
const cycleContainer = new Container();
await assert.rejects(
  async () => {
    await cycleContainer.registerModule({
      id: "cycle",
      name: "Cycle",
      providers: [
        { provide: "CycleA", useClass: CycleA },
        { provide: "CycleB", useClass: CycleB },
      ],
    });
  },
  /Circular dependency detected/,
  "Should detect circular dependency during module registration"
);

// Test 1c: Reactive StorageService Watcher
let watchedNew: string | null = null;
let watchedOld: string | null = null;
const unwatch = storage.watch<string>("reactive_key", (newV, oldV) => {
  watchedNew = newV;
  watchedOld = oldV;
});
await storage.set("reactive_key", "hello_reactive");
assert.strictEqual(watchedNew, "hello_reactive", "Storage watcher should receive newValue");
assert.strictEqual(watchedOld, null, "Storage watcher should receive oldValue");
unwatch();

console.log(
  "   ✓ DI Container & Module resolution passed (order-independent, cycle-safe, reactive storage)."
);

// 2. Test DTO Validation
console.log("\n2. Testing CreateTempMailDto validation:");
const validDto = new CreateTempMailDto({ duration: 30 });
assert.strictEqual(validDto.duration, 30, "DTO should parse valid duration");
assert.throws(
  () => new CreateTempMailDto({ duration: -5 }),
  /Duration must be between/,
  "DTO should reject negative duration"
);
console.log("   ✓ DTO validation passed.");

// 3. Test Core, Shared, and Feature Domain Utilities
console.log("\n3. Testing Utilities (Core, Shared, Domain):");
// Domain: TempMailUtils
const otp1 = TempMailUtils.extractOtpCode("Your verification code is 492810. Do not share it.");
assert.strictEqual(otp1, "492810", "Should extract 6-digit verification code");
const magicLinkEmail =
  "<style>p { color: #555555; font-size: 14px; }</style><p>Click this link: https://app.faceless.video/auth/confirm?token_hash=pkce_4a686446df7117ce7f7d25cd7c55edb230587c7c779ccdb04595105a&type=signup</p>";
assert.strictEqual(
  TempMailUtils.extractOtpCode(magicLinkEmail),
  null,
  "Should return null for magic link email without OTP"
);
const cd = TempMailUtils.formatCountdown(125);
assert.strictEqual(cd, "02:05", "Should format 125 seconds to 02:05");
assert.strictEqual(
  TempMailUtils.formatCountdown(0),
  "Expired",
  "Should report Expired for 0 seconds"
);

// Core: StringUtils, DomUtils, TimeUtils, escapeHtml
const escaped = StringUtils.escapeHtml('hello <world> & "quotes"');
assert.strictEqual(escaped, "hello &lt;world&gt; &amp; &quot;quotes&quot;", "Should escape HTML");
assert.strictEqual(
  escapeHtml("hello <world>"),
  "hello &lt;world&gt;",
  "Direct escapeHtml function should match"
);
const rel = TimeUtils.formatRelativeTime(new Date(Date.now() - 5000));
assert.strictEqual(rel, "just now", "Should format recent time as just now");

// Core: ExtensionUtils
const isInvalidated = ExtensionUtils.isContextInvalidated(
  new Error("Extension context invalidated.")
);
assert.strictEqual(isInvalidated, true, "Should detect invalidated extension context");

// Shared UI Components
const btnHtml = renderButton({ id: "testBtn", text: "Click Me", variant: "primary" });
assert.ok(btnHtml.includes('id="testBtn"'), "Button HTML should include id");
assert.ok(btnHtml.includes("ext-btn-primary"), "Button HTML should include primary variant class");
assert.ok(btnHtml.includes("Click Me"), "Button HTML should include label");

const iconBtnHtml = renderIconButton({ id: "testIconBtn", icon: "<svg></svg>", title: "Refresh" });
assert.ok(iconBtnHtml.includes('id="testIconBtn"'), "IconButton HTML should include id");
assert.ok(iconBtnHtml.includes('title="Refresh"'), "IconButton HTML should include title");

const badgeHtml = renderBadge({ text: "5", variant: "primary" });
assert.ok(badgeHtml.includes("ext-badge-primary"), "Badge HTML should include primary class");
assert.ok(badgeHtml.includes("5"), "Badge HTML should include text");

const statusHtml = renderStatusIndicator({ id: "statusTest", active: true });
assert.ok(
  statusHtml.includes("ext-status-dot active"),
  "Status indicator should include active dot class"
);

const copyInputHtml = renderCopyInput({
  id: "copyInp",
  buttonId: "copyBtn",
  value: "user@test.com",
});
assert.ok(copyInputHtml.includes('id="copyInp"'), "CopyInput should include input id");
assert.ok(copyInputHtml.includes('id="copyBtn"'), "CopyInput should include button id");
assert.ok(copyInputHtml.includes("user@test.com"), "CopyInput should include value");

const emptyHtml = renderEmptyState({ title: "No Messages", subtitle: "Check back later" });
assert.ok(emptyHtml.includes("No Messages"), "Empty state should include title");

const modalHtml = renderModal({ id: "testModal", title: "Details" });
assert.ok(modalHtml.includes('id="testModal"'), "Modal should include modal id");
assert.ok(modalHtml.includes("Details"), "Modal should include title");

console.log("   ✓ Core, Shared, Domain Utilities & Shared UI Components tests passed.");

// 4. Test TempMailService API
console.log("\n4. Testing TempMailService with live API (api.tempmail.ing):");
const email = await tempMailService.generateEmail(new CreateTempMailDto({ duration: 60 }));
console.log(`   Generated address: ${email.address}`);
assert.ok(email.address.includes("@"), "Address should contain @");
assert.strictEqual(tempMailService.hasValidEmail(), true, "Should report valid email");

const inbox = await tempMailService.fetchInbox();
assert.ok(Array.isArray(inbox), "Inbox should return an array");
console.log(`   Inbox items: ${inbox.length}`);

console.log("\n5. Testing AiExporterModule (Parsers, Formatters, DTO, Service & DI Resolution):");
// 5.1 Platform detection
assert.strictEqual(ChatParserUtils.detectPlatform("chatgpt.com"), "chatgpt");
assert.strictEqual(ChatParserUtils.detectPlatform("claude.ai"), "claude");
assert.strictEqual(ChatParserUtils.detectPlatform("gemini.google.com"), "gemini");
assert.strictEqual(ChatParserUtils.detectPlatform("chat.deepseek.com"), "deepseek");
assert.strictEqual(ChatParserUtils.detectPlatform("example.com"), "generic");

// 5.2 Test conversation data
const sampleConvo = {
  id: "test_chat_1",
  title: "Testing AI Exporter Architecture",
  platform: "chatgpt" as const,
  url: "https://chatgpt.com/c/12345",
  createdAt: 1720000000000,
  messages: [
    { id: "m1", role: "user" as const, content: "Hello AI assistant" },
    { id: "m2", role: "assistant" as const, content: "Hello human! How can I help you today?" },
  ],
  totalWords: 11,
};

// 5.3 DTO validation
const validExportDto = new ExportChatDto({ conversation: sampleConvo, format: "markdown" });
assert.strictEqual(validExportDto.format, "markdown");
const pdfDto = new ExportChatDto({ conversation: sampleConvo, format: "pdf" });
assert.strictEqual(pdfDto.format, "pdf");
assert.throws(
  () => new ExportChatDto({ conversation: { ...sampleConvo, messages: [] } }),
  /empty conversation/
);

// 5.4 Formatters
const mdOutput = MarkdownFormatterUtils.format(sampleConvo);
assert.ok(mdOutput.includes('title: "Testing AI Exporter Architecture"'));
assert.ok(mdOutput.includes("### 🧑 User"));
assert.ok(mdOutput.includes("### 🤖 Assistant"));

const jsonOutput = JsonFormatterUtils.format(sampleConvo);
const parsedJson = JSON.parse(jsonOutput);
assert.strictEqual(parsedJson.version, "1.0");
assert.strictEqual(parsedJson.conversation.title, sampleConvo.title);

const htmlOutput = HtmlFormatterUtils.format(sampleConvo);
assert.ok(htmlOutput.includes("<!DOCTYPE html>"));
assert.ok(htmlOutput.includes("Testing AI Exporter Architecture"));

const printPdfOutput = HtmlFormatterUtils.format(sampleConvo, { autoPrint: true });
assert.ok(printPdfOutput.includes("window.print()"));

// 5.5 DI Service Resolution & History
const aiService = container.get<AiExporterService>(AiExporterService);
assert.ok(aiService, "AiExporterService must resolve from DI container");

const formattedPdf = aiService.formatConversation(sampleConvo, "pdf");
assert.strictEqual(formattedPdf.mimeType, "text/html");
assert.ok(formattedPdf.content.includes("window.print()"));
const generatedFilename = aiService.generateFilename(sampleConvo, ".md");
assert.ok(generatedFilename.startsWith("chatgpt_testing-ai-exporter-architecture_"));
assert.ok(generatedFilename.endsWith(".md"));

await aiService.clearHistory();
let hist = await aiService.getHistory();
assert.strictEqual(hist.length, 0);

await aiService.recordHistory({
  id: "hist_1",
  title: sampleConvo.title,
  platform: "chatgpt",
  messageCount: 2,
  exportedAt: Date.now(),
  format: "markdown",
  url: sampleConvo.url,
  content: mdOutput,
});

hist = await aiService.getHistory();
assert.strictEqual(hist.length, 1);
assert.strictEqual(hist[0].title, sampleConvo.title);
assert.strictEqual(hist[0].content, mdOutput);

await aiService.deleteHistoryItem("hist_1");
hist = await aiService.getHistory();
assert.strictEqual(hist.length, 0);

// 5.6 Caveman Directives & Settings
const liteReminder = CavemanDirectiveUtils.buildReminder("lite");
assert.ok(liteReminder.includes("LITE"), "Lite reminder should mention LITE");
const fullReminder = CavemanDirectiveUtils.buildReminder("full");
assert.ok(fullReminder.includes("FULL"), "Full reminder should mention FULL");
const ultraPrimer = CavemanDirectiveUtils.buildPrimer("ultra");
assert.ok(ultraPrimer.includes("Intensity ULTRA"), "Ultra primer should mention Intensity ULTRA");

assert.strictEqual(CavemanDirectiveUtils.isPrefixed("[Caveman mode is ON] Hello"), true);
assert.strictEqual(CavemanDirectiveUtils.isPrefixed("[stay in caveman mode — FULL] Hello"), true);
assert.strictEqual(CavemanDirectiveUtils.isPrefixed("Hello world"), false);

// History primer detection (if previous bubbles don't have Caveman, must send primer)
assert.strictEqual(CavemanDirectiveUtils.needsPrimer([]), true);
assert.strictEqual(CavemanDirectiveUtils.needsPrimer(null), true);
assert.strictEqual(
  CavemanDirectiveUtils.needsPrimer([
    { role: "user", content: "Halo apa kabar" },
    { role: "assistant", content: "Kabar baik!" },
  ]),
  true,
  "Ongoing chat with no caveman in earlier bubbles must require primer"
);
assert.strictEqual(
  CavemanDirectiveUtils.needsPrimer([
    { role: "user", content: "[Caveman mode is ON for this whole conversation...] Halo" },
    { role: "assistant", content: "Halo." },
  ]),
  false,
  "Chat already primed should not require primer"
);

const wrappedPrimer = CavemanDirectiveUtils.wrapText("Explain recursion", true, "full");
assert.ok(wrappedPrimer.startsWith("[Caveman mode is ON"));
assert.ok(wrappedPrimer.includes("Explain recursion"));

const wrappedReminder = CavemanDirectiveUtils.wrapText("Explain recursion", false, "full");
assert.ok(wrappedReminder.startsWith("[stay in caveman mode — FULL]"));
assert.ok(wrappedReminder.includes("Explain recursion"));

// Invalid/stale level must inject the stop directive, never resume terse mode
const stopWrapped = CavemanDirectiveUtils.wrapText("Explain recursion", false, "bogus" as never);
assert.ok(
  stopWrapped.startsWith("[stop caveman mode"),
  "Unknown level must inject the stop directive"
);
assert.ok(stopWrapped.includes("Explain recursion"));
assert.ok(
  CavemanDirectiveUtils.buildStop().includes("normal"),
  "Stop directive resumes normal replies"
);
assert.strictEqual(CavemanDirectiveUtils.isPrefixed("[stop caveman mode] Please clarify"), true);
assert.strictEqual(
  CavemanDirectiveUtils.isStopPrefixed("[stop caveman mode] Please clarify"),
  true
);
assert.strictEqual(CavemanDirectiveUtils.isStopPrefixed("normal text"), false);

// Stop flow: hasPrimer/hasStop detection + wrapStop for toggle-off in a primed chat
assert.strictEqual(
  CavemanDirectiveUtils.hasStop([{ role: "user", content: "[stop caveman mode] Resume normal" }]),
  true
);
assert.strictEqual(
  CavemanDirectiveUtils.hasStop([{ role: "user", content: "[stay in caveman mode — LITE]" }]),
  false
);
assert.strictEqual(CavemanDirectiveUtils.hasStop(null), false);
const stopOff = CavemanDirectiveUtils.wrapStop("Continue explaining");
assert.ok(stopOff.startsWith("[stop caveman mode"), "wrapStop must prepend the stop directive");
assert.strictEqual(
  CavemanDirectiveUtils.wrapStop("[stop caveman mode] already stopped"),
  "[stop caveman mode] already stopped",
  "wrapStop must be idempotent"
);

// Caveman Settings in AiExporterService
let cavemanSettings = await aiService.getCavemanSettings();
assert.strictEqual(cavemanSettings.enabled, false);
assert.strictEqual(cavemanSettings.level, "full");

cavemanSettings = await aiService.updateCavemanSettings({ enabled: true, level: "ultra" });
assert.strictEqual(cavemanSettings.enabled, true);
assert.strictEqual(cavemanSettings.level, "ultra");

const retrievedSettings = await aiService.getCavemanSettings();
assert.strictEqual(retrievedSettings.enabled, true);
assert.strictEqual(retrievedSettings.level, "ultra");
console.log("   ✓ AiExporterModule Caveman directive builders and reactive settings passed.");

console.log(
  "   ✓ AiExporterModule parsers, formatters, DTO, PDF auto-print, and DI history tests passed."
);

await container.destroy();

console.log("\n[Test] All NestJS TypeScript tests passed with 100% success! ✓");
