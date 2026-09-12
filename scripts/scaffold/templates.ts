import { join } from "node:path";
import { CYAN, GREEN, RESET, YELLOW } from "./term";

export interface FeatureContext {
  id: string;
  root: string;
  prefix: string;
  camel: string;
  Pascal: string;
  Name: string;
  Description: string;
  icon: string;
  color: string;
  withContent: boolean;
}

export type TemplateWriter = (rel: string, content: string) => void;

export function writeTemplates(ctx: FeatureContext, write: TemplateWriter): void {
  const { id, prefix, camel, Pascal, Name, Description } = ctx;
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
  description: "${Description}",
  icon: "${ctx.icon}", // dari --icon; daftar: src/lib/icons.ts
  color: "${ctx.color}",
  background: setupBackground,${
    ctx.withContent
      ? `
  // Lazy import: bundle fitur hanya dimuat bila fitur aktif (kontrak #register-lazy).
  content: () => import("./content").then((m) => m.setupContent()),`
      : "\n  // --no-content: tanpa content script. Tambahkan content: bila nanti perlu."
  }
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

  if (ctx.withContent) {
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
  }

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
  <p class="text-xs text-ext-text-secondary">${Description}</p>
  <Button onclick={() => {}}>Example action</Button>
</div>
`,
  );
}

export function logSummary(ctx: FeatureContext): void {
  const { id, prefix, Name } = ctx;
  const summary = [
    ["ID", id],
    ["Prefix", prefix],
    ["Icon", ctx.icon],
    ["Color", ctx.color],
  ] as const;
  const pad = (label: string): string => label.padEnd(8, " ");
  console.log(`
${GREEN}✔ Feature "${Name}" generated successfully!${RESET}
${summary.map(([k, v]) => `${CYAN}  ${pad(`${k}:`)}${RESET}${v}`).join("\n")}
${YELLOW}\n Next steps:${RESET}
  1. Definisikan aksi nyata di ${CYAN}constants/${prefix}.constants.ts${RESET} (jaga prefix!)
  2. Tulis logika di ${CYAN}services/${RESET} — jaga content.ts tetap tipis
  3. Daftarkan feature ke registry (otomatis terbaca entrypoints)
  4. Verifikasi: ${CYAN}pnpm check:structure && pnpm typecheck && pnpm lint${RESET}
`);
}

export function featureRoot(id: string): string {
  return join(process.cwd(), "src", "features", id);
}
