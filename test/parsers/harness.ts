import assert from "node:assert";
import {
  AI_PLATFORMS,
  type SupportedAiPlatform,
} from "@/features/ai-toolkit/constants/ai-toolkit.constants";
import { parseActivePage } from "@/features/ai-toolkit/utils/chat-parser.utils";
import { FIXTURES, type ParserFixture } from "./fixtures";

console.log("[Parsers] Checking every saved AI-site fixture...\n");

let parseMarkup: ((html: string) => Document) | null = null;
try {
  const { DOMParser } = await import("linkedom");
  parseMarkup = (html: string) =>
    new DOMParser().parseFromString(html, "text/html") as unknown as Document;
} catch {
  console.log("   ! linkedom unavailable — parser fixtures skipped.");
  process.exit(0);
}

const parse = parseMarkup as (html: string) => Document;
const failures: string[] = [];
let passed = 0;

function withHostname<T>(origin: string, run: () => T): T {
  const url = new URL(origin);
  const globalScope = globalThis as Record<string, unknown>;
  const previous = globalScope.window;
  globalScope.window = { location: { hostname: url.hostname, href: url.href } };
  try {
    return run();
  } finally {
    globalScope.window = previous;
  }
}

function check(fixture: ParserFixture): void {
  const captured: string[] = [];
  const debug = console.debug;
  const warn = console.warn;
  console.debug = (...args: unknown[]) => captured.push(`debug: ${args.join(" ")}`);
  console.warn = (...args: unknown[]) => captured.push(`warn: ${args.join(" ")}`);

  let convo: ReturnType<typeof parseActivePage>;
  try {
    convo = withHostname(fixture.origin, () => parseActivePage(parse(fixture.html)));
  } finally {
    console.debug = debug;
    console.warn = warn;
  }

  const problems: string[] = [];
  const detected = convo?.platform;
  if (fixture.expect === null) {
    if (convo !== null) {
      problems.push(`expected no conversation, got ${convo.messages.length} message(s)`);
    }
  } else {
    const { count, roles, includes } = fixture.expect;
    if (!convo) {
      problems.push(`expected ${count} message(s), got none`);
    } else {
      if (detected !== fixture.platform) {
        problems.push(`platform ${detected} != ${fixture.platform}`);
      }
      if (convo.messages.length !== count) {
        problems.push(`expected ${count} message(s), got ${convo.messages.length}`);
      }
      const actualRoles = convo.messages.map((m) => m.role).join(",");
      if (roles && actualRoles !== roles.join(",")) {
        problems.push(`roles ${actualRoles || "(none)"} != ${roles.join(",")}`);
      }
      for (const snippet of includes ?? []) {
        if (!convo.messages.some((m) => m.content.includes(snippet))) {
          problems.push(`no message contains ${JSON.stringify(snippet)}`);
        }
      }
    }
  }

  const dump = convo
    ? convo.messages
        .map((m, i) => `\n      ${i + 1}. [${m.role}] ${m.content.slice(0, 70)}`)
        .join("")
    : "";
  const matched = captured.find((line) => line.startsWith("debug:"))?.replace("debug: ", "");

  if (problems.length === 0) {
    passed++;
    console.log(`   ✓ ${fixture.name}${matched ? ` — ${matched}` : ""}`);
    return;
  }

  failures.push(fixture.name);
  console.log(`   ✗ ${fixture.name}`);
  for (const problem of problems) console.log(`       ${problem}`);
  if (dump) console.log(`     actual:${dump}`);
  for (const line of captured) console.log(`       ${line}`);
}

for (const fixture of FIXTURES) check(fixture);

const supported = (Object.keys(AI_PLATFORMS) as SupportedAiPlatform[]).filter(
  (p) => p !== "generic",
);
const covered = new Set(FIXTURES.map((f) => f.platform));
for (const platform of supported) {
  if (!covered.has(platform)) {
    failures.push(`${platform} (missing fixture)`);
    console.log(
      `   ✗ no fixture for "${platform}" — add markup for ${AI_PLATFORMS[platform].name}`,
    );
  }
}

assert.ok(covered.has("generic"), "a fixture must cover the generic fallback");

console.log("");
if (failures.length > 0) {
  console.log(`[Parsers] ${failures.length} fixture(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`[Parsers] All ${passed} parser fixtures passed. ✓`);
