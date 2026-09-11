import { storage } from "wxt/utils/storage";
import { createUniqueId } from "@/lib/utils";
import { USER_SCRIPTS_STORAGE_KEYS } from "../constants/user-scripts.constants";
import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
import { parseUserScriptHeader } from "../utils/header-parser.utils";

const scriptsItem = storage.defineItem<UserScriptRecord[]>(USER_SCRIPTS_STORAGE_KEYS.SCRIPTS, {
  defaultValue: [],
});

/** Run logs, keyed by scriptId (bounded per script). */
const runLogsItem = storage.defineItem<Record<string, UserScriptRunLogEntry[]>>(
  USER_SCRIPTS_STORAGE_KEYS.RUN_LOGS,
  { defaultValue: {} }
);

/** GM storage values, keyed by scriptId → key → value. */
const gmValuesItem = storage.defineItem<Record<string, Record<string, unknown>>>(
  USER_SCRIPTS_STORAGE_KEYS.GM_VALUES,
  { defaultValue: {} }
);

const RUN_LOG_LIMIT = 30;

export class UserScriptsService {
  /** All stored scripts, in priority order (SM-02, SM-08). */
  static list(): Promise<UserScriptRecord[]> {
    return scriptsItem.getValue();
  }

  static async get(id: string): Promise<UserScriptRecord | null> {
    const all = await scriptsItem.getValue();
    return all.find((s) => s.id === id) ?? null;
  }

  /** Insert or update by id; re-parses metadata from the current code. */
  static async save(record: UserScriptRecord): Promise<UserScriptRecord> {
    const all = await scriptsItem.getValue();
    const idx = all.findIndex((s) => s.id === record.id);
    const updated: UserScriptRecord = { ...record, updatedAt: Date.now() };
    if (idx >= 0) all[idx] = updated;
    else all.push(updated);
    await scriptsItem.setValue(all);
    return updated;
  }

  /** Adds a new script; returns its record. */
  static async add(record: UserScriptRecord): Promise<UserScriptRecord> {
    await UserScriptsService.save(record);
    return record;
  }

  static async remove(id: string): Promise<boolean> {
    const all = await scriptsItem.getValue();
    const next = all.filter((s) => s.id !== id);
    if (next.length === all.length) return false;
    await scriptsItem.setValue(next);
    // SM-04: drop the script's run history and GM values too.
    const logs = await runLogsItem.getValue();
    if (logs[id]) {
      delete logs[id];
      await runLogsItem.setValue(logs);
    }
    const values = await gmValuesItem.getValue();
    if (values[id]) {
      delete values[id];
      await gmValuesItem.setValue(values);
    }
    return true;
  }

  /** SM-05: duplicate as a starting point for a new script. */
  static async duplicate(id: string): Promise<UserScriptRecord | null> {
    const src = await UserScriptsService.get(id);
    if (!src) return null;
    const copy = newScriptCopy(src);
    await UserScriptsService.save(copy);
    return copy;
  }

  /** SM-08: reorder (priority = array order). */
  static async move(id: string, toIndex: number): Promise<UserScriptRecord[]> {
    const all = await scriptsItem.getValue();
    const from = all.findIndex((s) => s.id === id);
    if (from < 0) return all;
    const clamped = Math.max(0, Math.min(all.length - 1, toIndex));
    const [rec] = all.splice(from, 1);
    all.splice(clamped, 0, rec);
    await scriptsItem.setValue(all);
    return all;
  }

  /** UI-03: enable/disable toggle. */
  static async setEnabled(id: string, enabled: boolean): Promise<UserScriptRecord[]> {
    const all = await scriptsItem.getValue();
    const rec = all.find((s) => s.id === id);
    if (!rec) return all;
    rec.enabled = enabled;
    rec.updatedAt = Date.now();
    await scriptsItem.setValue(all);
    return all;
  }

  /** Persist scripts replaced wholesale (import). */
  static async replaceAll(records: UserScriptRecord[]): Promise<void> {
    await scriptsItem.setValue(records);
  }

  // ---- Run log (UI-04) ----

  static async appendRunLog(entry: UserScriptRunLogEntry & { scriptId: string }): Promise<void> {
    const { scriptId, ...rest } = entry;
    const logs = await runLogsItem.getValue();
    const list = logs[scriptId] ?? [];
    list.unshift(rest);
    logs[scriptId] = list.slice(0, RUN_LOG_LIMIT);
    await runLogsItem.setValue(logs);
  }

  static async getRunLog(scriptId: string): Promise<UserScriptRunLogEntry[]> {
    const logs = await runLogsItem.getValue();
    return logs[scriptId] ?? [];
  }

  static async clearRunLog(scriptId: string): Promise<void> {
    const logs = await runLogsItem.getValue();
    delete logs[scriptId];
    await runLogsItem.setValue(logs);
  }

  // ---- GM value storage (SM via GM_getValue/GM_setValue) ----

  static async gmGet(scriptId: string, key: string): Promise<unknown> {
    const all = await gmValuesItem.getValue();
    return all[scriptId]?.[key];
  }

  static async gmSet(scriptId: string, key: string, value: unknown): Promise<void> {
    const all = await gmValuesItem.getValue();
    const bucket = all[scriptId] ?? {};
    bucket[key] = value;
    all[scriptId] = bucket;
    await gmValuesItem.setValue(all);
  }

  static async gmDelete(scriptId: string, key: string): Promise<void> {
    const all = await gmValuesItem.getValue();
    if (all[scriptId]) {
      delete all[scriptId][key];
      await gmValuesItem.setValue(all);
    }
  }

  static async gmList(scriptId: string): Promise<string[]> {
    const all = await gmValuesItem.getValue();
    return Object.keys(all[scriptId] ?? {});
  }
}

/** Clone with a fresh id/name and reset run state. */
function newScriptCopy(src: UserScriptRecord): UserScriptRecord {
  const now = Date.now();
  return {
    ...src,
    id: createUniqueId("us"),
    meta: { ...src.meta, name: `${src.meta.name} (copy)` },
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
  };
}

/** Builds a fresh record by parsing code (used by install-from-URL and import). */
export function recordFromCode(code: string): UserScriptRecord {
  const now = Date.now();
  const meta = parseUserScriptHeader(code);
  return {
    id: createUniqueId("us"),
    code,
    meta,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
  };
}
