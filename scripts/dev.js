import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import * as esbuild from "esbuild";

const PORT = 3210;
let buildTimestamp = Date.now().toString();

// 1. Local Reload Signal Server
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/version") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(buildTimestamp);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[Dev] Auto-reload server listening at http://127.0.0.1:${PORT}`);
});

// Auto-reload polling client injected into background service worker
const devReloadBanner = `
(() => {
  if (typeof chrome === "undefined" || !chrome.runtime?.reload) return;
  let lastVer = null;
  setInterval(async () => {
    try {
      const res = await fetch("http://127.0.0.1:${PORT}/version");
      const ver = await res.text();
      if (lastVer && ver !== lastVer) {
        console.log("[Dev] Reloading extension...");
        chrome.runtime.reload();
      }
      lastVer = ver;
    } catch {}
  }, 1000);
})();
`;

const commonOptions = {
  bundle: true,
  sourcemap: "inline",
  target: "es2022",
  logLevel: "error",
};

function copyIcons() {
  fs.mkdirSync("dist/assets/icons", { recursive: true });
  const icons = ["icon-16.png", "icon-48.png", "icon-128.png"];
  for (const icon of icons) {
    const src = path.join("assets/icons", icon);
    const dest = path.join("dist/assets/icons", icon);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
}

async function buildAll() {
  const start = Date.now();
  try {
    fs.mkdirSync("dist/popup", { recursive: true });

    // CSS
    const popupCssResult = await esbuild.build({
      entryPoints: ["src/popup/index.css"],
      bundle: true,
      write: false,
    });
    const popupCss = popupCssResult.outputFiles[0].text;
    fs.writeFileSync("dist/popup/index.css", popupCss);

    await esbuild.build({
      entryPoints: ["src/content/content.css"],
      bundle: true,
      outfile: "dist/content.css",
    });

    // Background SW with reload poller
    await esbuild.build({
      ...commonOptions,
      entryPoints: ["src/background/main.ts"],
      format: "esm",
      outfile: "dist/background.js",
      banner: { js: devReloadBanner },
    });

    // Content Script
    await esbuild.build({
      ...commonOptions,
      entryPoints: ["src/content/main.ts"],
      format: "iife",
      outfile: "dist/content.js",
      define: {
        __POPUP_CSS__: JSON.stringify(popupCss),
      },
    });

    // Popup Script
    await esbuild.build({
      ...commonOptions,
      entryPoints: ["src/popup/main.ts"],
      format: "esm",
      outfile: "dist/popup/main.js",
    });

    // HTML
    if (fs.existsSync("src/popup/index.html")) {
      const rawHtml = fs.readFileSync("src/popup/index.html", "utf8");
      const inlinedHtml = rawHtml.replace(
        '<link rel="stylesheet" href="index.css">',
        `<style>${popupCss}</style>\n  <link rel="stylesheet" href="index.css">`
      );
      fs.writeFileSync("dist/popup/index.html", inlinedHtml);
    }

    copyIcons();

    buildTimestamp = Date.now().toString();
    console.log(`[Dev] Rebuilt in ${Date.now() - start}ms - Brave will reload.`);
  } catch (err) {
    console.error("[Dev] Build failed:", err.message);
  }
}

// Initial build
await buildAll();

// Debounced file watcher
let debounceTimer = null;
function triggerRebuild() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    buildAll();
  }, 150);
}

fs.watch("src", { recursive: true }, (_eventType, filename) => {
  if (filename) {
    console.log(`[Dev] Changed: ${filename}`);
    triggerRebuild();
  }
});

if (fs.existsSync("assets")) {
  fs.watch("assets", { recursive: true }, (_eventType, filename) => {
    if (filename) {
      console.log(`[Dev] Changed: ${filename}`);
      triggerRebuild();
    }
  });
}

console.log("[Dev] Watching for changes in src/ and assets/ ... Press Ctrl+C to stop.");
