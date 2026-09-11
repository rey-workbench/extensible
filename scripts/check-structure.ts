import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const FEATURES_DIR = join(ROOT, "src", "features");

interface Finding {
  rule: string;
  file: string;
  message: string;
}

const findings: Finding[] = [];

function find(rule: string, file: string, message: string): void {
  findings.push({ rule, file, message });
}

function read(p: string): string {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function walk(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function listFeatures(): string[] {
  if (!existsSync(FEATURES_DIR)) return [];
  return readdirSync(FEATURES_DIR).filter((f) => statSync(join(FEATURES_DIR, f)).isDirectory());
}

function prefixOf(id: string): string {
  return id.replace(/-/g, "_");
}

for (const feature of listFeatures()) {
  const dir = join(FEATURES_DIR, feature);
  const files = walk(dir);
  const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/");

  const registerPath = join(dir, "register.ts");
  const contentPath = join(dir, "content.ts");
  const backgroundPath = join(dir, "background.ts");

  if (!existsSync(registerPath)) {
    find("register-exists", rel(dir), "missing register.ts");
  } else {
    const src = read(registerPath);
    if (!src.includes("defineFeature(")) {
      find("register-define", rel(registerPath), "does not call defineFeature()");
    }
    if (!src.includes(`import("./content")`)) {
      find("register-lazy-content", rel(registerPath), 'content must be lazy: import("./content")');
    }
    if (/setup[A-Za-z]*Content/.test(src) && !src.includes("m.setupContent()")) {
      find("register-setup-name", rel(registerPath), "content must call m.setupContent()");
    }
  }

  if (existsSync(contentPath)) {
    const src = read(contentPath);
    if (!/export\s+(async\s+)?function\s+setupContent\b/.test(src)) {
      find("setup-content-name", rel(contentPath), "must export function setupContent");
    }
  }
  if (existsSync(backgroundPath)) {
    const src = read(backgroundPath);
    if (!/export\s+(async\s+)?function\s+setupBackground\b/.test(src)) {
      find("setup-background-name", rel(backgroundPath), "must export function setupBackground");
    }
  }

  for (const f of files.filter((f) => f.endsWith(".ts"))) {
    const src = read(f);
    if (/export\s+class\s+\w+\s*\{/.test(src) && /static\s+\w/.test(src)) {
      find("no-static-class", rel(f), "static-class service — use plain exported functions");
    }
  }

  if (files.some((f) => f.split(/[\\/]/).includes("views"))) {
    find("no-views-layer", rel(dir), "views/ found — imperative UI belongs in components/");
  }

  if (files.some((f) => f.split(/[\\/]/).includes("content") && f !== contentPath)) {
    find("no-content-dir", rel(dir), "content/ directory found — use utils/ or another layer");
  }

  for (const f of files.filter((f) => f.includes("services") && f.endsWith(".ts"))) {
    const src = read(f);
    if (/export\s+function\s+\w*(Factory|Record|Copy|FromCode)\w*\(/.test(src)) {
      find("factories-out", rel(f), "record factory in services/ — move to utils/");
    }
  }

  const expectedPrefix = prefixOf(feature);
  const constantsFiles = files.filter((f) => f.includes("constants") && f.endsWith(".ts"));
  for (const f of constantsFiles) {
    const src = read(f);
    const actionStrings = [...src.matchAll(/"([a-z0-9_]+):[a-z0-9_]+"/g)]
      .map((m) => m[1])
      .filter((p) => p !== "local" && p !== "sync" && p !== "session");
    const storageStrings = [...src.matchAll(/"(?:local|sync|session):([a-z0-9_]+)[:_]/g)].map(
      (m) => m[1],
    );
    const badActions = actionStrings.filter((p) => p !== expectedPrefix);
    const badStorage = storageStrings.filter((p) => p !== expectedPrefix);
    if (badActions.length) {
      find(
        "prefix-derivation",
        rel(f),
        `action prefix ${[...new Set(badActions)].join(", ")} ≠ expected "${expectedPrefix}" (from id "${feature}")`,
      );
    }
    if (badStorage.length) {
      find(
        "prefix-derivation",
        rel(f),
        `storage prefix ${[...new Set(badStorage)].join(", ")} ≠ expected "${expectedPrefix}" (from id "${feature}")`,
      );
    }
  }

  for (const f of files.filter((f) => !f.includes("constants") && f.endsWith(".ts"))) {
    const src = read(f);
    for (const m of src.matchAll(new RegExp(`"${expectedPrefix}:[a-z0-9_]+"`, "g"))) {
      find(
        "no-hardcoded-actions",
        rel(f),
        `hardcoded action string ${m[0]} — use the ACTIONS const`,
      );
    }
  }

  // Aturan storage & URL berlaku untuk semua file kode non-constants (.ts/.svelte).
  const codeFiles = files.filter((f) => /\.(ts|svelte)$/.test(f) && !f.endsWith(".d.ts"));
  for (const f of codeFiles) {
    if (/[\\/]constants[\\/]/.test(f)) continue;
    const src = read(f);

    if (/\b(localStorage|sessionStorage)\b\s*[.[]/.test(src)) {
      find(
        "no-direct-web-storage",
        rel(f),
        "direct localStorage/sessionStorage — use wxt storage items in services/ (sync + area terisolasi per fitur)",
      );
    }

    for (const m of src.matchAll(/https?:\/\/[^\s"'`<>\\,;)"]+/gi)) {
      const url = m[0];
      if (url.includes("*")) continue; // match pattern browser, mis. https://*/*
      if (/\.(invalid|test|example|localhost)([/:?#]|$)/i.test(url)) continue; // TLD reserved (RFC 2606)
      if (/^https?:\/\/(www\.)?w3\.org\//i.test(url)) continue; // identifier namespace XML, bukan endpoint
      find(
        "no-hardcoded-urls",
        rel(f),
        `hardcoded URL ${url} — pindahkan endpoint ke constants/<id>.constants.ts`,
      );
    }
  }

  if (existsSync(contentPath)) {
    const lines = read(contentPath).split(/\r?\n/).length;
    if (lines > 40) {
      find(
        "thin-content",
        rel(contentPath),
        `${lines} lines > 40 — extract logic to services/ or utils/`,
      );
    }
  }
}

if (findings.length) {
  console.error(`\n✗ Structure check: ${findings.length} violation(s)\n`);
  for (const f of findings) {
    console.error(`  [${f.rule}] ${f.file}`);
    console.error(`    ${f.message}\n`);
  }
  process.exit(1);
} else {
  console.log("✓ Structure check: all features conform to the layout contract.");
}
