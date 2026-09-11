import { storage } from "wxt/utils/storage";
import { createUniqueId } from "@/lib/utils";
import { USER_SCRIPTS_STORAGE_KEYS } from "../constants/user-scripts.constants";
import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
import { parseUserScriptHeader } from "../utils/header-parser.utils";

const scriptsItem = storage.defineItem<UserScriptRecord[]>(USER_SCRIPTS_STORAGE_KEYS.SCRIPTS, {
  defaultValue: [],
});

const runLogsItem = storage.defineItem<Record<string, UserScriptRunLogEntry[]>>(
  USER_SCRIPTS_STORAGE_KEYS.RUN_LOGS,
  { defaultValue: {} },
);

const gmValuesItem = storage.defineItem<Record<string, Record<string, unknown>>>(
  USER_SCRIPTS_STORAGE_KEYS.GM_VALUES,
  { defaultValue: {} },
);

const RUN_LOG_LIMIT = 30;

export class UserScriptsService {
  private static scriptTokens = new Map<string, string>();

  static getScriptToken(scriptId: string): string {
    let token = UserScriptsService.scriptTokens.get(scriptId);
    if (!token) {
      token = `${scriptId}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      UserScriptsService.scriptTokens.set(scriptId, token);
    }
    return token;
  }

  static getAllScriptTokens(): Record<string, string> {
    return Object.fromEntries(UserScriptsService.scriptTokens.entries());
  }

  static list(): Promise<UserScriptRecord[]> {
    return scriptsItem.getValue();
  }

  static async get(id: string): Promise<UserScriptRecord | null> {
    const all = await scriptsItem.getValue();
    return all.find((s) => s.id === id) ?? null;
  }

  static async save(record: UserScriptRecord): Promise<UserScriptRecord> {
    const all = await scriptsItem.getValue();
    const idx = all.findIndex((s) => s.id === record.id);
    const updated: UserScriptRecord = { ...record, updatedAt: Date.now() };
    if (idx >= 0) all[idx] = updated;
    else all.push(updated);
    await scriptsItem.setValue(all);
    return updated;
  }

  static async remove(id: string): Promise<boolean> {
    const all = await scriptsItem.getValue();
    const next = all.filter((s) => s.id !== id);
    if (next.length === all.length) return false;
    await scriptsItem.setValue(next);
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

  static async duplicate(id: string): Promise<UserScriptRecord | null> {
    const src = await UserScriptsService.get(id);
    if (!src) return null;
    const copy = newScriptCopy(src);
    await UserScriptsService.save(copy);
    return copy;
  }

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

  static async setEnabled(id: string, enabled: boolean): Promise<UserScriptRecord[]> {
    const all = await scriptsItem.getValue();
    const rec = all.find((s) => s.id === id);
    if (!rec) return all;
    rec.enabled = enabled;
    rec.updatedAt = Date.now();
    await scriptsItem.setValue(all);
    return all;
  }

  static async replaceAll(records: UserScriptRecord[]): Promise<void> {
    await scriptsItem.setValue(records);
  }

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
