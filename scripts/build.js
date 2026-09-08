import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

console.log("[Build] Starting Production TypeScript & Ultra-Minification Build...\n");

// 1. Run TypeScript Type Checker
console.log("1. Type Checking with TypeScript:");
try {
  execSync("npx tsc --noEmit", { stdio: "inherit" });
  console.log("   ✓ TypeScript type check passed without errors.\n");
} catch (_e) {
  console.error("   ✗ TypeScript compilation errors detected!");
  process.exit(1);
}

// Clean and ensure dist directories
if (fs.existsSync("dist/popup/index.js")) {
  fs.unlinkSync("dist/popup/index.js");
}
fs.mkdirSync("dist/popup", { recursive: true });
fs.mkdirSync("dist/assets/icons", { recursive: true });

// Common esbuild minification options for smallest output
const commonOptions = {
  bundle: true,
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  treeShaking: true,
  legalComments: "none",
  target: "es2022",
};

// 2. Bundle & Minify CSS Assets First (needed for inlining into content script & HTML)
console.log("2. Bundling & Minifying CSS Assets:");
const popupCssResult = esbuild.buildSync({
  entryPoints: ["src/popup/index.css"],
  bundle: true,
  minify: true,
  write: false,
});
const popupCss = popupCssResult.outputFiles[0].text;
fs.writeFileSync("dist/popup/index.css", popupCss);

esbuild.buildSync({
  entryPoints: ["src/content/content.css"],
  bundle: true,
  minify: true,
  outfile: "dist/content.css",
});

// 3. Bundle & Ultra-minify Background Service Worker
console.log("\n3. Bundling Background Service Worker:");
esbuild.buildSync({
  ...commonOptions,
  entryPoints: ["src/background/main.ts"],
  format: "esm",
  outfile: "dist/background.js",
});

// 4. Bundle & Ultra-minify Content Script with inlined CSS
console.log("\n4. Bundling Content Script & Side Notch Drawer:");
esbuild.buildSync({
  ...commonOptions,
  entryPoints: ["src/content/main.ts"],
  format: "iife",
  outfile: "dist/content.js",
  define: {
    __POPUP_CSS__: JSON.stringify(popupCss),
  },
});

// 5. Bundle & Ultra-minify Popup Script
console.log("\n5. Bundling Popup Script:");
esbuild.buildSync({
  ...commonOptions,
  entryPoints: ["src/popup/main.ts"],
  format: "esm",
  outfile: "dist/popup/main.js",
});

// 6. Copy HTML with Inlined CSS Fallback
const rawHtml = fs.readFileSync("src/popup/index.html", "utf8");
const inlinedHtml = rawHtml.replace(
  '<link rel="stylesheet" href="index.css">',
  `<style>${popupCss}</style>\n  <link rel="stylesheet" href="index.css">`
);
fs.writeFileSync("dist/popup/index.html", inlinedHtml);

// 7. Copy Icons
const icons = ["icon-16.png", "icon-48.png", "icon-128.png"];
for (const icon of icons) {
  const src = path.join("assets/icons", icon);
  const dest = path.join("dist/assets/icons", icon);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// 8. Print Bundle Sizes
console.log("\n================ BUNDLE SIZE SUMMARY ================");
const files = [
  "dist/background.js",
  "dist/content.js",
  "dist/content.css",
  "dist/popup/main.js",
  "dist/popup/index.css",
];

for (const f of files) {
  if (fs.existsSync(f)) {
    const size = fs.statSync(f).size;
    const kb = (size / 1024).toFixed(2);
    console.log(`  ${f.padEnd(24)} : ${kb.padStart(6)} KB (${size} bytes)`);
  }
}
console.log("=====================================================\n");
console.log("✓ Ultra-minified production build completed successfully!");
