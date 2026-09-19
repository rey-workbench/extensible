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
  withApi: boolean;
}

export type TemplateWriter = (rel: string, content: string) => void;

export function writeTemplates(ctx: FeatureContext, write: TemplateWriter): void {
  const { id, prefix, camel, Pascal, Name, Description, icon } = ctx;
  const upper = prefix.toUpperCase();

  write(
    "register.ts",
    `import { defineFeature } from "@/lib/feature-registry";
import ${Pascal} from "./components/${Pascal}.svelte";
import { setupBackground } from "./background";

// Satu-satunya titik daftar fitur. Entry membaca registry ini — tidak ada
// pendaftaran manual di entrypoints; features/index.ts meng-glob semua
// */register.ts.
defineFeature({
  id: "${id}",
  name: "${Name}",
  description: "${Description}",
  icon: "${icon}", // daftar: src/lib/icons.ts
  color: "${ctx.color}",
  background: setupBackground,${
    ctx.withContent
      ? `
  // Lazy: bundle hanya dimuat saat fitur aktif (kontrak register-lazy).
  content: () => import("./content").then((m) => m.setupContent()),`
      : ""
  }
  popup: ${Pascal},
});
`,
  );

  write(
    `constants/${prefix}.constants.ts`,
    `// Konstanta fitur ${Name}.
// ATURAN PREFIX (dicek pnpm check:structure): action & storage key WAJIB
// diawali "${prefix}:" / "local:${prefix}:" — turunan langsung dari id "${id}".
// String action tidak boleh ditulis ulang di file lain: selalu pakai ${upper}_ACTIONS.

export const ${upper}_ACTIONS = {
  EXAMPLE: "${prefix}:example", // TODO: ganti dengan aksi nyata
} as const;

export const ${upper}_STORAGE_KEYS = {
  SETTINGS: "local:${prefix}:settings",
} as const;

export const DEFAULT_${upper}_SETTINGS = {
  enabled: true, // TODO: sesuaikan
};
`,
  );

  write(
    `types/${prefix}.types.ts`,
    `// Tipe data fitur ${Name}.

export interface ${Pascal}Settings {
  enabled: boolean; // TODO: bentuk settings fitur ini
}
`,
  );

  write(
    `services/${prefix}.service.ts`,
    `import { storage } from "wxt/utils/storage";
import { readSettings } from "@/lib/utils";
import { DEFAULT_${upper}_SETTINGS, ${upper}_STORAGE_KEYS } from "../constants/${prefix}.constants";
import type { ${Pascal}Settings } from "../types/${prefix}.types";

// Satu storage.defineItem per key; defaultValue menjaga data rusak tetap aman.
export const ${camel}SettingsItem = storage.defineItem<${Pascal}Settings>(
  ${upper}_STORAGE_KEYS.SETTINGS,
  { defaultValue: DEFAULT_${upper}_SETTINGS },
);

// GAYA WAJIB: fungsi polos, bukan class dengan static (dicek check:structure).
// Semua akses storage & logika bisnis di sini, bukan di content.ts/komponen.

export async function get${Pascal}Settings(): Promise<${Pascal}Settings> {
  return readSettings(
    await ${camel}SettingsItem.getValue(),
    DEFAULT_${upper}_SETTINGS,
  );
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
    "background.ts",
    `import { onMessage } from "@/lib/messaging";
import { ${upper}_ACTIONS } from "./constants/${prefix}.constants";

// Wiring background (service worker). Nama export WAJIB setupBackground
// (dicek check:structure). Semua yang butuh tab/izin/network lintas-halaman
// dikerjakan di sini, bukan di content script.
// CATATAN: handler tanpa await jangan ditandai async (biome useAwait).
export function setupBackground(): void {
  onMessage(${upper}_ACTIONS.EXAMPLE, () => {
    // TODO: implementasi. Nilai yang di-return otomatis dikirim ke pemanggil.
    return null;
  });
}
`,
  );

  if (ctx.withContent) {
    write(
      "content.ts",
      `import { onMessage } from "@/lib/messaging";
import { ${upper}_ACTIONS } from "./constants/${prefix}.constants";

// Wiring content script — HARUS TIPIS (≤40 baris, dicek check:structure).
// Nama export WAJIB setupContent. Logika nyata → services/ atau utils/.
// UI yang diinjeksi ke halaman → shadow DOM via @/lib/shadow-ui
// (contoh lengkap: side-notch/content.ts dan temp-mail/services/badge-manager).
export function setupContent(): void {
  onMessage(${upper}_ACTIONS.EXAMPLE, () => {
    // TODO: aksi dari background/popup ke halaman ini.
    return null;
  });
}
`,
    );
  }

  if (ctx.withApi) {
    write(
      "api.ts",
      `// Pintu lintas-fitur (satu-satunya file yang boleh diimpor fitur lain),
// supaya refactor internal ${Name} tidak merusak pemanggilnya.
// Pakai hanya kalau ada fitur lain yang benar-benar memanggil — file ini
// dihitung mati oleh knip selama belum ada pemanggil.
// Contoh: import { ${camel}Api } from "@/features/${id}/api";

import { sendMessage } from "@/lib/messaging";
import { ${upper}_ACTIONS } from "./constants/${prefix}.constants";

export const ${camel}Api = {
  example: () => sendMessage(${upper}_ACTIONS.EXAMPLE),
};
`,
    );
  }

  write(
    `components/${Pascal}.svelte`,
    `<script lang="ts">
  import { onMount } from "svelte";
  import Button from "@/components/Button.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import { sendMessage } from "@/lib/messaging";
  import { ${upper}_ACTIONS } from "../constants/${prefix}.constants";
  import { get${Pascal}Settings, update${Pascal}Settings } from "../services/${prefix}.service";
  import type { ${Pascal}Settings } from "../types/${prefix}.types";

  // UI fitur ${Name}, dirender di popup maupun drawer hub (satu komponen untuk
  // dua permukaan). Komponen bersama: @/components/… — jangan bikin ulang
  // tombol, kartu, atau daftar kosong.
  let settings = $state<${Pascal}Settings | null>(null);
  let busy = $state(false);

  onMount(async () => {
    settings = await get${Pascal}Settings();
  });

  async function toggle(enabled: boolean): Promise<void> {
    settings = await update${Pascal}Settings({ enabled });
  }

  async function run(): Promise<void> {
    busy = true;
    try {
      await sendMessage(${upper}_ACTIONS.EXAMPLE);
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex flex-col gap-3 p-2.5">
  <div class="ext-card flex items-center justify-between p-4">
    <div class="min-w-0">
      <div class="text-body font-bold text-ext-text">${Name}</div>
      <div class="text-label text-ext-muted">${Description}</div>
    </div>
    {#if settings}
      <Toggle
        checked={settings.enabled}
        label="Toggle ${Name}"
        onchange={(value) => void toggle(value)}
      />
    {/if}
  </div>

  <Button variant="primary" icon="${icon}" disabled={busy} onclick={() => void run()}>
    Example action
  </Button>
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
    ["API", ctx.withApi ? "api.ts dibuat" : "tanpa api.ts (--api bila perlu)"],
  ] as const;
  const pad = (label: string): string => label.padEnd(8, " ");

  console.log(`
${GREEN}✔ Feature "${Name}" generated successfully!${RESET}
${summary.map(([k, v]) => `${CYAN}  ${pad(`${k}:`)}${RESET}${v}`).join("\n")}
${YELLOW}
 Next steps:${RESET}
  1. Aksi nyata di ${CYAN}constants/${prefix}.constants.ts${RESET} (jaga prefix!)
  2. Logika di ${CYAN}services/${RESET}, util murni di ${CYAN}utils/${RESET},
     ${CYAN}content.ts${RESET} tetap ≤40 baris${ctx.withContent ? "" : " (fitur ini tanpa content script)"}
  3. Fitur sudah terdaftar: ${CYAN}features/index.ts${RESET} meng-glob
     ${CYAN}*/register.ts${RESET} — tidak ada daftar manual
  4. Kalau menambah storage key: catat di ${CYAN}docs/data.md${RESET}
  5. Butuh setting? Tulis schema-nya di ${CYAN}settings.ts${RESET} (kind/label/hint +
     read/write) lalu pasang di ${CYAN}register.ts${RESET}; layar pengaturannya sudah
     ada di hub (tombol gear) — jangan bikin UI setting sendiri
  6. Verifikasi: ${CYAN}pnpm check:structure && pnpm knip && pnpm test && pnpm lint${RESET}

 Referensi implementasi: ${CYAN}temp-mail${RESET} (storage + inbox), ${CYAN}youtube${RESET}
 (aksi background + fetch), ${CYAN}user-scripts${RESET} (daftar + editor).
`);
}

export function featureRoot(id: string): string {
  return join(process.cwd(), "src", "features", id);
}
