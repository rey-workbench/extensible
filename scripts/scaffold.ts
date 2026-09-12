import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin } from "node:process";
import { featureRoot, logSummary, writeTemplates } from "./scaffold/templates";
import { askSelect, askYesNo, CYAN, GREEN, RED, RESET } from "./scaffold/term";

function availableIcons(): string[] {
  try {
    const src = readFileSync(join(process.cwd(), "src", "lib", "icons.ts"), "utf8");
    const block = src.match(/export const ICON_NAMES = \[([\s\S]*?)\]/);
    return block ? [...block[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]) : [];
  } catch {
    return [];
  }
}

function usage(): string {
  const icons = availableIcons();
  return `${CYAN}Extensible Feature Generator${RESET}

${GREEN}Usage:${RESET}
  pnpm gen <feature-id> [options]

${GREEN}Arguments:${RESET}
  feature-id              kebab-case id fitur (wajib)

${GREEN}Options:${RESET}
  --name <text>           Nama tampilan (default: dari id, Title Case)
  --description <text>    Deskripsi satu baris fitur
  --icon <name>           Ikon dari src/lib/icons.ts (default: puzzle)
  --color <hex>           Warna aksen fitur (default: #1B4DDB)
  --no-content            Lewati pembuatan content script
  -h, --help              Tampilkan bantuan ini

${GREEN}Interactive:${RESET}
  Jalankan tanpa flags di terminal (TTY) → wizard TUI pilihan keyboard:
  ↑/↓ pilih · Enter ok · Esc batal
${icons.length ? `\n${GREEN}Available icons:${RESET}\n  ${icons.join(", ")}` : ""}`;
}

interface Options {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  withContent: boolean;
  iconProvided: boolean;
  colorProvided: boolean;
  contentProvided: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    id: "",
    name: "",
    description: "",
    icon: "puzzle",
    color: "#1B4DDB",
    withContent: true,
    iconProvided: false,
    colorProvided: false,
    contentProvided: false,
  };
  const positional: string[] = [];
  const valueFlags = new Set(["--name", "--description", "--icon", "--color"]);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (valueFlags.has(arg)) {
      const value = argv[++i];
      if (!value) die(`Missing value for ${arg}`);
      if (arg === "--name") options.name = value;
      else if (arg === "--description") options.description = value;
      else if (arg === "--icon") {
        options.icon = value;
        options.iconProvided = true;
      } else if (arg === "--color") {
        options.color = value;
        options.colorProvided = true;
      }
    } else if (arg === "--no-content") {
      options.withContent = false;
      options.contentProvided = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    } else {
      positional.push(arg);
    }
  }

  options.id = positional[0] ?? "";
  return options;
}

function die(msg: string): never {
  console.error(`${RED}✗ ${msg}${RESET}`);
  process.exit(1);
}

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

async function runWizard(options: Options): Promise<void> {
  const knIcons = availableIcons();
  if (knIcons.length === 0) knIcons.push("puzzle");

  if (!knIcons.includes(options.icon)) {
    die(`Unknown icon "${options.icon}" — pick one of: ${knIcons.join(", ")} (src/lib/icons.ts)`);
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(options.color)) {
    die(`Invalid color "${options.color}" — use 6-digit hex, e.g. #1B4DDB`);
  }

  if (stdin.isTTY) {
    if (!options.iconProvided) {
      const idx = await askSelect(
        "Pilih ikon fitur",
        knIcons,
        Math.max(0, knIcons.indexOf("puzzle")),
      );
      if (idx !== null) options.icon = knIcons[idx];
    }
    if (!options.colorProvided) {
      const palette = [
        "#1B4DDB",
        "#00AA88",
        "#D93025",
        "#B8860B",
        "#7B1FA2",
        "#00897B",
        "#F4511E",
        "#5F6368",
      ];
      const cIdx = await askSelect("Pilih warna aksen", palette, 0);
      if (cIdx !== null) options.color = palette[cIdx];
    }
    if (!options.contentProvided) {
      options.withContent = await askYesNo("Sertakan content script?", true);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const id = options.id;
  if (!id) {
    console.log(usage());
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
    die(`Invalid id "${id}" — use kebab-case, e.g. password-gen`);
  }

  await runWizard(options);

  const root = featureRoot(id);
  if (existsSync(root)) die(`Feature "${id}" already exists at ${root}`);

  const camel = toCamelId(id);
  const Pascal = toPascal(id);
  const Name =
    options.name ||
    kebabToWords(id)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  const Description = options.description || "TODO: one-line description";

  const dirs = [
    root,
    join(root, "constants"),
    join(root, "types"),
    join(root, "services"),
    join(root, "components"),
  ];
  for (const d of dirs) mkdirSync(d, { recursive: true });

  const write = (rel: string, content: string): void => {
    writeFileSync(join(root, rel), content.trimStart(), "utf8");
    console.log(`  + src/features/${id}/${rel}`);
  };

  writeTemplates(
    {
      id,
      root,
      prefix: toPrefix(id),
      camel,
      Pascal,
      Name,
      Description,
      icon: options.icon,
      color: options.color,
      withContent: options.withContent,
    },
    write,
  );

  logSummary({
    id,
    root,
    prefix: toPrefix(id),
    camel,
    Pascal,
    Name,
    Description,
    icon: options.icon,
    color: options.color,
    withContent: options.withContent,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
