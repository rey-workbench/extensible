import { stdin, stdout } from "node:process";
import * as readline from "node:readline";

export const CYAN = "\x1b[36m";
export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";
export const RESET = "\x1b[0m";

type Key = readline.Key;

function clearAbove(n: number): void {
  for (let i = 0; i < n; i++) stdout.write("\x1b[1A\x1b[2K");
}

function listRows(items: string[]): number {
  return 1 + Math.min(items.length, 12) + (items.length > 12 ? 1 : 0) + 1;
}

function renderSelect(items: string[], active: number): void {
  const visible = 12;
  const start = Math.max(0, Math.min(active - visible + 1, items.length - visible));
  const end = Math.min(items.length, start + visible);
  for (let i = start; i < end; i++) {
    const cursor = i === active ? `${GREEN}❯${RESET} ` : "  ";
    const text = i === active ? `${CYAN}${items[i]}${RESET}` : items[i];
    stdout.write(`${cursor}${text}\n`);
  }
  if (items.length > visible) stdout.write(`${YELLOW}  (${items.length - visible} more)${RESET}\n`);
  stdout.write(`${YELLOW}  ↑/↓ pilih · Enter ok · Esc batal${RESET}\n`);
}

export function askSelect(
  label: string,
  items: string[],
  defaultIndex = 0,
): Promise<number | null> {
  if (!stdin.isTTY) return Promise.resolve(null);
  stdout.write(`${CYAN}?${RESET} ${label}\n`);
  let active = defaultIndex;
  renderSelect(items, active);
  return new Promise((resolve) => {
    // @ts-ignore - TS 5.3 IDE language server AsyncIterator return mismatch with @types/node 26
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    const rows = listRows(items);
    function cleanup(): void {
      stdin.removeListener("keypress", onKey);
      stdin.setRawMode(false);
      stdin.pause();
    }
    function onKey(_ch: string, key: Key): void {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(1);
      }
      if (key.name === "escape") {
        clearAbove(rows);
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        stdout.write("\n");
        cleanup();
        resolve(active);
        return;
      }
      if (key.name === "down" || key.name === "j") {
        active = (active + 1) % items.length;
      } else if (key.name === "up" || key.name === "k") {
        active = (active - 1 + items.length) % items.length;
      } else {
        return;
      }
      clearAbove(rows);
      stdout.write(`${CYAN}?${RESET} ${label}\n`);
      renderSelect(items, active);
    }
    stdin.on("keypress", onKey);
  });
}

export function askYesNo(label: string, defaultYes: boolean): Promise<boolean> {
  if (!stdin.isTTY) return Promise.resolve(defaultYes);
  stdin.resume();
  return new Promise((resolve) => {
    // @ts-ignore - TS 5.3 IDE language server AsyncIterator return mismatch with @types/node 26
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const suffix = defaultYes ? "[Y/n]" : "[y/N]";
    rl.question(`${CYAN}?${RESET} ${label} ${suffix} `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "") return resolve(defaultYes);
      resolve(a === "y" || a === "yes");
    });
  });
}
