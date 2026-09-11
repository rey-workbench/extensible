import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function kebabToWords(id: string): string[] {
  return id.split("-").filter(Boolean);
}
function toPascal(id: string): string {
  return kebabToWords(id)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}
function toPrefix(id: string): string {
  return id.replace(/-/g, "_");
}
function toCamelId(id: string): string {
  const [first, ...rest] = kebabToWords(id);
  return first + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}
function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const id = process.argv[2];
if (!id) die("Usage: pnpm gen <feature-id>   (e.g. pnpm gen password-gen)");
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
  die(`Invalid id "${id}" — use kebab-case, e.g. password-gen`);
}

const root = join(process.cwd(), "src", "features", id);
if (existsSync(root)) die(`Feature "${id}" already exists at ${root}`);

const prefix = toPrefix(id);
const camel = toCamelId(id);
const Pascal = toPascal(id);
const Name = kebabToWords(id)
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(" ");

const dirs = [
  root,
  join(root, "constants"),
  join(root, "types"),
  join(root, "services"),
  join(root, "components"),
];
for (const d of dirs) mkdirSync(d, { recursive: true });

function write(rel: string, content: string): void {
  writeFileSync(join(root, rel), content.trimStart(), "utf8");
  console.log(`  + src/features/${id}/${rel}`);
}

/* eslint-disable prettier/prettier */

write(
  "register.ts",
  `import { defineFeature } from "@/lib/feature-registry";
import { setupBackground } from "./background";
import ${Pascal} from "./components/${Pascal}.svelte";

// Satu-satunya titik daftar fitur. Entry (background/content/popup) membaca
// dari registry ini — TIDAK ada pendaftaran manual di entrypoints.
defineFeature({
  id: "${id}",
  name: "${Name}",
  description: "TODO: one-line description",
  icon: "puzzle", // lihat src/lib/icons.ts untuk daftar nama ikon
  color: "#1B4DDB",
  background: setupBackground,
  // Lazy import: bundle fitur hanya dimuat bila fitur aktif (kontrak #register-lazy).
  content: () => import("./content").then((m) => m.setupContent()),
  popup: ${Pascal},
});
`,
);

write(
  `constants/${prefix}.constants.ts`,
  `// Konstanta fitur ${Name}.
// ATURAN PREFIX (dicek pnpm check:structure): semua action & storage key
// WAJIB diawali "${prefix}:" / "local:${prefix}:" — turunan langsung dari id "${id}".
// Jangan pernah hardcode string action di luar file ini — selalu pakai ${prefix.toUpperCase()}_ACTIONS.X.

export const ${prefix.toUpperCase()}_ACTIONS = {
  EXAMPLE: "${prefix}:example", // TODO: ganti dengan aksi nyata
} as const;

export const ${prefix.toUpperCase()}_STORAGE_KEYS = {
  SETTINGS: "local:${prefix}:settings",
} as const;

export const DEFAULT_${prefix.toUpperCase()}_SETTINGS = {
  enabled: true, // TODO: sesuaikan
};
`,
);

write(
  `types/${prefix}.types.ts`,
  `// Tipe data fitur ${Name}.

export interface ${Pascal}Settings {
  // TODO: bentuk settings fitur ini (disimpan di chrome.storage.local).
  enabled: boolean;
}
`,
);

write(
  `services/${prefix}.service.ts`,
  `import { storage } from "wxt/utils/storage";
import { readSettings } from "@/lib/utils";
import { DEFAULT_${prefix.toUpperCase()}_SETTINGS, ${prefix.toUpperCase()}_STORAGE_KEYS } from "../constants/${prefix}.constants";
import type { ${Pascal}Settings } from "../types/${prefix}.types";

// ---- Storage items -------------------------------------------------------
// Satu storage.defineItem per key. defaultValue menjaga data korup/stale tetap aman.

export const ${camel}SettingsItem = storage.defineItem<${Pascal}Settings>(
  ${prefix.toUpperCase()}_STORAGE_KEYS.SETTINGS,
  { defaultValue: DEFAULT_${prefix.toUpperCase()}_SETTINGS },
);

// ---- Service functions ---------------------------------------------------
// GAYA WAJIB: fungsi polos (BUKAN class dengan static) — dicek pnpm check:structure.
// Semua akses storage/logika bisnis fitur ada di sini, TIDAK di content.ts.

export async function get${Pascal}Settings(): Promise<${Pascal}Settings> {
  return readSettings(await ${camel}SettingsItem.getValue(), DEFAULT_${prefix.toUpperCase()}_SETTINGS);
}

export async function update${Pascal}Settings(
  partial: Partial<${Pascal}Settings>,
): Promise<${Pascal}Settings> {
  const current = await get${Pascal}Settings();
  const updated = { ...current, ...partial };
  await ${camel}SettingsItem.setValue(updated);
  return updated;
}
`,
);

write(
  "api.ts",
  `// Pintu lintas-fitur (satu-satunya file yang boleh diimpor fitur LAIN).
// Fitur lain TIDAK boleh mengimpor constants/types/service langsung —
// agar refactor internal ${Name} tidak merusak fitur lain.
// Contoh pemakaian di fitur lain:
//   import { ${camel}Api } from "@/features/${id}/api";

import { sendMessage } from "@/lib/messaging";
import { ${prefix.toUpperCase()}_ACTIONS } from "./constants/${prefix}.constants";

export const ${camel}Api = {
  example: () => sendMessage(${prefix.toUpperCase()}_ACTIONS.EXAMPLE),
};
`,
);

write(
  "background.ts",
  `import { onMessage } from "@/lib/messaging";
import { ${prefix.toUpperCase()}_ACTIONS } from "./constants/${prefix}.constants";

// Wiring background (service worker). Nama export WAJIB setupBackground
// (dicek pnpm check:structure). Isi: daftarkan onMessage handler + alarm.
// CATATAN: handler TANPA await -> jangan pakai async (biome useAwait).
export function setupBackground(): void {
  onMessage(${prefix.toUpperCase()}_ACTIONS.EXAMPLE, () => {
    // TODO: implementasi aksi background. Return nilai -> dikirim balik ke caller.
    return null;
  });
}
`,
);

write(
  "content.ts",
  `import { onMessage } from "@/lib/messaging";
import { ${prefix.toUpperCase()}_ACTIONS } from "./constants/${prefix}.constants";

// Wiring content script — HARUS TIPIS (≤40 baris, dicek pnpm check:structure).
// Nama export WAJIB setupContent. Logika nyata → services/ atau utils/.
// UI yang diinjeksi ke halaman → shadow DOM via @/lib/shadow-ui
// (isolasi CSS + klik aman dari handler halaman; lihat side-notch/temp-mail).
// CATATAN: handler TANPA await -> deklarasi non-async (biome useAwait).
export function setupContent(): void {
  onMessage(${prefix.toUpperCase()}_ACTIONS.EXAMPLE, () => {
    // TODO: aksi dari popup/background ke halaman ini. Return -> balasan ke caller.
    return null;
  });
}
`,
);

write(
  `components/${Pascal}.svelte`,
  `<script lang="ts">
  // Popup UI fitur ${Name} — dirender di dalam popup/drawer.
  // Pakai komponen bersama: @/components (Button, Card, Toggle, Icon, EmptyState…).
  import Button from "@/components/Button.svelte";

  // TODO: state & aksi. Komunikasi ke background selalu via sendMessage(ACTIONS.X).
</script>

<div class="flex flex-col gap-2.5 p-2.5">
  <h2 class="text-sm font-bold text-ext-text">${Name}</h2>
  <p class="text-xs text-ext-text-secondary">TODO: isi UI fitur ini.</p>
  <Button onclick={() => {}}>Example action</Button>
</div>
`,
);

console.log(`
✓ Feature "${Name}" generated (id: ${id}, prefix: ${prefix})

Next steps:
  1. Isi deskripsi + ikon + warna di register.ts
  2. Definisikan aksi nyata di constants/${prefix}.constants.ts (jaga prefix!)
  3. Tulis logika di services/ — jaga content.ts tetap tipis
  4. Verifikasi: pnpm check:structure && pnpm typecheck && pnpm lint
`);
