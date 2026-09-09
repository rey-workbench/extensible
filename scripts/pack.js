import fs from "node:fs";
import path from "node:path";
import crx3 from "crx3";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const name = pkg.name;
const version = pkg.version;
const outputDir = path.resolve(".output");

async function packCrx() {
  const chromeDir = path.join(outputDir, "chrome-mv3");
  if (!fs.existsSync(chromeDir)) {
    throw new Error("Chrome build not found. Run 'pnpm run build:chrome' first.");
  }

  const crxPath = path.join(outputDir, `${name}-${version}-chrome.crx`);
  const options = { crxPath };

  if (process.env.CRX_KEY_PATH && fs.existsSync(process.env.CRX_KEY_PATH)) {
    options.keyPath = process.env.CRX_KEY_PATH;
  } else if (process.env.CRX_KEY) {
    const tempKey = path.join(outputDir, ".crx-key.pem");
    fs.writeFileSync(tempKey, process.env.CRX_KEY);
    options.keyPath = tempKey;
  }

  const res = await crx3([chromeDir], options);
  const canonicalCrx = path.join(outputDir, `${name}-${version}.crx`);
  fs.copyFileSync(crxPath, canonicalCrx);

  return { path: crxPath, appId: res.appId };
}

function packXpi() {
  const firefoxZip = path.join(outputDir, `${name}-${version}-firefox.zip`);
  if (!fs.existsSync(firefoxZip)) {
    throw new Error("Firefox zip not found. Run 'pnpm run zip:firefox' first.");
  }

  const xpiPath = path.join(outputDir, `${name}-${version}-firefox.xpi`);
  fs.copyFileSync(firefoxZip, xpiPath);

  const canonicalXpi = path.join(outputDir, `${name}-${version}.xpi`);
  fs.copyFileSync(firefoxZip, canonicalXpi);

  return { path: xpiPath };
}

async function main() {
  const mode = process.argv[2] || "all";
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`[Pack] Packaging formats for ${name} v${version}...`);

  if (mode === "all" || mode === "crx") {
    const crxInfo = await packCrx();
    console.log(`  ✓ CRX package created (App ID: ${crxInfo.appId})`);
  }

  if (mode === "all" || mode === "xpi") {
    packXpi();
    console.log("  ✓ XPI package created");
  }

  console.log("\n[Pack] Output artifacts in .output/:");
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith(".zip") || f.endsWith(".crx") || f.endsWith(".xpi"));

  for (const file of files) {
    const stat = fs.statSync(path.join(outputDir, file));
    const kb = (stat.size / 1024).toFixed(2);
    console.log(`  - ${file.padEnd(45)} ${kb.padStart(8)} KB`);
  }
}

main().catch((err) => {
  console.error("[Pack] Error:", err.message);
  process.exit(1);
});
