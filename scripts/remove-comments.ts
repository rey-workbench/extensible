import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

interface StripStats {
  filesScanned: number;
  filesModified: number;
  commentsRemoved: number;
}

const PRESERVE_PATTERNS = [
  /^\/\/\/\s*<reference/,
  /^\/\/\s*@ts-(check|nocheck|ignore|expect-error)/,
  /^\/\/\s*biome-ignore/,
  /^\/\*\s*biome-ignore/,
  /^\/\/\s*eslint-/,
  /^\/\*\s*eslint-/,
  /^\/\/\s*SAFETY:/,
  /^#!/,
  /^\/\/\s*==\/?UserScript==/,
  /^\/\/\s*@(name|namespace|version|description|author|match|include|exclude|grant|run-at|require|resource|connect|noframes)/,
];

function shouldPreserve(commentText: string): boolean {
  const trimmed = commentText.trim();
  return PRESERVE_PATTERNS.some((regex) => regex.test(trimmed));
}

export function stripJsComments(code: string): { result: string; count: number } {
  const sf = ts.createSourceFile("temp.ts", code, ts.ScriptTarget.Latest, true);
  const seen = new Set<string>();
  const ranges: ts.CommentRange[] = [];

  function visit(node: ts.Node): void {
    const leading = ts.getLeadingCommentRanges(code, node.getFullStart()) || [];
    const trailing = ts.getTrailingCommentRanges(code, node.getEnd()) || [];
    for (const r of [...leading, ...trailing]) {
      const key = `${r.pos}:${r.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        ranges.push(r);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  ranges.sort((a, b) => a.pos - b.pos);

  let result = "";
  let lastPos = 0;
  let count = 0;

  for (const r of ranges) {
    const commentText = code.slice(r.pos, r.end);
    if (shouldPreserve(commentText)) {
      continue;
    }
    result += code.slice(lastPos, r.pos);
    lastPos = r.end;
    count++;
  }

  result += code.slice(lastPos);
  return { result, count };
}

export function stripCssComments(code: string): { result: string; count: number } {
  let count = 0;
  const result = code.replace(
    /("(?:\\"|[^"])*"|'(?:\\'|[^'])*')|(\/\*[\s\S]*?\*\/)/g,
    (match, str, comment) => {
      if (str) return str;
      if (comment) {
        if (comment.includes("biome-ignore") || comment.includes("stylelint-disable")) {
          return comment;
        }
        count++;
        return "";
      }
      return match;
    },
  );
  return { result, count };
}

export function stripSvelteComments(code: string): { result: string; count: number } {
  let totalCount = 0;

  let modified = code.replace(
    /(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (_match, open, scriptContent, close) => {
      const { result, count } = stripJsComments(scriptContent);
      totalCount += count;
      return open + result + close;
    },
  );

  modified = modified.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open, styleContent, close) => {
      const { result, count } = stripCssComments(styleContent);
      totalCount += count;
      return open + result + close;
    },
  );

  modified = modified.replace(/<!--([\s\S]*?)-->/g, (match, inner) => {
    if (inner.includes("svelte-ignore") || inner.includes("biome-ignore")) {
      return match;
    }
    totalCount++;
    return "";
  });

  return { result: modified, count: totalCount };
}

function processFile(filePath: string, dryRun: boolean): number {
  const content = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();

  let stripped = content;
  let count = 0;

  if (ext === ".svelte") {
    const res = stripSvelteComments(content);
    stripped = res.result;
    count = res.count;
  } else if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(ext)) {
    const res = stripJsComments(content);
    stripped = res.result;
    count = res.count;
  } else if ([".css"].includes(ext)) {
    const res = stripCssComments(content);
    stripped = res.result;
    count = res.count;
  }

  if (count > 0 && stripped !== content) {
    if (!dryRun) {
      fs.writeFileSync(filePath, stripped, "utf8");
    }
    return count;
  }

  return 0;
}

const IGNORE_DIRS = new Set(["node_modules", ".git", ".output", ".wxt", "dist", "build"]);

const SUPPORTED_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".svelte", ".css"]);

function walk(dir: string, stats: StripStats, dryRun: boolean, modifiedFiles: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), stats, dryRun, modifiedFiles);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) {
        stats.filesScanned++;
        const fullPath = path.join(dir, entry.name);
        const removed = processFile(fullPath, dryRun);
        if (removed > 0) {
          stats.filesModified++;
          stats.commentsRemoved += removed;
          modifiedFiles.push(fullPath);
          console.log(
            `  ${dryRun ? "[dry-run] " : ""}${path.relative(process.cwd(), fullPath)} (-${removed} comments)`,
          );
        }
      }
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const targetDirs = args.filter((a) => !a.startsWith("--"));
  const dirs = targetDirs.length > 0 ? targetDirs : ["src", "scripts", "test"];

  console.log(`\x1b[36m=== Auto Remove Comments${dryRun ? " (DRY RUN)" : ""} ===\x1b[0m`);

  const stats: StripStats = {
    filesScanned: 0,
    filesModified: 0,
    commentsRemoved: 0,
  };
  const modifiedFiles: string[] = [];

  for (const dir of dirs) {
    const resolved = path.resolve(process.cwd(), dir);
    if (fs.existsSync(resolved)) {
      if (fs.statSync(resolved).isDirectory()) {
        walk(resolved, stats, dryRun, modifiedFiles);
      } else {
        stats.filesScanned++;
        const removed = processFile(resolved, dryRun);
        if (removed > 0) {
          stats.filesModified++;
          stats.commentsRemoved += removed;
          modifiedFiles.push(resolved);
          console.log(
            `  ${dryRun ? "[dry-run] " : ""}${path.relative(process.cwd(), resolved)} (-${removed} comments)`,
          );
        }
      }
    }
  }

  console.log("\x1b[32m✔ Completed:\x1b[0m");
  console.log(`  Files scanned:    ${stats.filesScanned}`);
  console.log(`  Files modified:   ${stats.filesModified}`);
  console.log(`  Comments removed: ${stats.commentsRemoved}`);

  if (!dryRun && modifiedFiles.length > 0) {
    console.log("\x1b[36mFormatting modified files with Biome...\\x1b[0m");
    try {
      execSync(`npx -y biome format --write ${modifiedFiles.map((f) => `"${f}"`).join(" ")}`, {
        stdio: "ignore",
      });
      console.log("\x1b[32m✔ Biome formatting complete.\x1b[0m");
    } catch {
      // ignore
    }
  }
}

try {
  main();
} catch (err) {
  console.error("\x1b[31mError:\x1b[0m", err);
  process.exit(1);
}
