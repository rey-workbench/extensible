import { storage } from "wxt/utils/storage";
import { USER_SCRIPTS_STORAGE_KEYS } from "../constants/user-scripts.constants";
import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
import { newScriptCopy } from "../utils/record-factory.utils";

export function sanitizeRecord(s: UserScriptRecord): UserScriptRecord {
  const meta = s.meta || ({} as UserScriptRecord["meta"]);
  return {
    ...s,
    meta: {
      ...meta,
      matches: Array.isArray(meta.matches)
        ? meta.matches
        : typeof meta.matches === "string" && meta.matches
          ? [meta.matches]
          : ["*://*/*"],
      excludes: Array.isArray(meta.excludes) ? meta.excludes : [],
      grants: Array.isArray(meta.grants) && meta.grants.length ? meta.grants : ["none"],
    },
  };
}

export const scriptsItem = storage.defineItem<UserScriptRecord[]>(
  USER_SCRIPTS_STORAGE_KEYS.SCRIPTS,
  {
    defaultValue: [],
  },
);

const runLogsItem = storage.defineItem<Record<string, UserScriptRunLogEntry[]>>(
  USER_SCRIPTS_STORAGE_KEYS.RUN_LOGS,
  { defaultValue: {} },
);

const gmValuesItem = storage.defineItem<Record<string, Record<string, unknown>>>(
  USER_SCRIPTS_STORAGE_KEYS.GM_VALUES,
  { defaultValue: {} },
);

const RUN_LOG_LIMIT = 30;

const GM_VALUE_MAX_BYTES = 64 * 1024;
const GM_BUCKET_MAX_BYTES = 512 * 1024;
const GM_KEY_LIMIT = 256;

function approximateBytes(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const scriptTokens = new Map<string, string>();

export function getScriptToken(scriptId: string): string {
  let token = scriptTokens.get(scriptId);
  if (!token) {
    token = `${scriptId}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    scriptTokens.set(scriptId, token);
  }
  return token;
}

export function getAllScriptTokens(): Record<string, string> {
  return Object.fromEntries(scriptTokens.entries());
}

export async function list(): Promise<UserScriptRecord[]> {
  const all = await scriptsItem.getValue();
  return (all ?? []).map(sanitizeRecord);
}

export async function get(id: string): Promise<UserScriptRecord | null> {
  const all = await list();
  return all.find((s) => s.id === id) ?? null;
}

export async function save(record: UserScriptRecord): Promise<UserScriptRecord> {
  const all = await list();
  const clean = sanitizeRecord(record);
  const idx = all.findIndex((s) => s.id === clean.id);
  const updated: UserScriptRecord = { ...clean, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  await scriptsItem.setValue(all);
  return updated;
}

export async function updateLastRun(id: string, lastRunAt: number): Promise<void> {
  const all = await list();
  const idx = all.findIndex((s) => s.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], lastRunAt };
    await scriptsItem.setValue(all);
  }
}

export async function remove(id: string): Promise<boolean> {
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

export async function duplicate(id: string): Promise<UserScriptRecord | null> {
  const src = await get(id);
  if (!src) return null;
  const copy = newScriptCopy(src);
  await save(copy);
  return copy;
}

export async function move(id: string, toIndex: number): Promise<UserScriptRecord[]> {
  const all = await scriptsItem.getValue();
  const from = all.findIndex((s) => s.id === id);
  if (from < 0) return all;
  const clamped = Math.max(0, Math.min(all.length - 1, toIndex));
  const [rec] = all.splice(from, 1);
  all.splice(clamped, 0, rec);
  await scriptsItem.setValue(all);
  return all;
}

export async function setEnabled(id: string, enabled: boolean): Promise<UserScriptRecord[]> {
  const all = await scriptsItem.getValue();
  const rec = all.find((s) => s.id === id);
  if (!rec) return all;
  rec.enabled = enabled;
  rec.updatedAt = Date.now();
  await scriptsItem.setValue(all);
  return all;
}

export async function appendRunLog(
  entry: UserScriptRunLogEntry & { scriptId: string },
): Promise<void> {
  const { scriptId, ...rest } = entry;
  const logs = await runLogsItem.getValue();
  const list = logs[scriptId] ?? [];
  list.unshift(rest);
  logs[scriptId] = list.slice(0, RUN_LOG_LIMIT);
  await runLogsItem.setValue(logs);
}

export async function getRunLog(scriptId: string): Promise<UserScriptRunLogEntry[]> {
  const logs = await runLogsItem.getValue();
  return logs[scriptId] ?? [];
}

export async function gmGet(scriptId: string, key: string): Promise<unknown> {
  const all = await gmValuesItem.getValue();
  return all[scriptId]?.[key];
}

export async function gmSet(scriptId: string, key: string, value: unknown): Promise<void> {
  const size = approximateBytes(value);
  if (size > GM_VALUE_MAX_BYTES) {
    throw new Error(
      `GM_setValue("${key}") rejected: value is ~${Math.round(size / 1024)} KB, the limit is ${GM_VALUE_MAX_BYTES / 1024} KB`,
    );
  }

  const all = await gmValuesItem.getValue();
  const bucket = all[scriptId] ?? {};
  if (!(key in bucket) && Object.keys(bucket).length >= GM_KEY_LIMIT) {
    throw new Error(`GM_setValue rejected: "${scriptId}" already stores ${GM_KEY_LIMIT} keys`);
  }

  const next = { ...bucket, [key]: value };
  const bucketSize = approximateBytes(next);
  if (bucketSize > GM_BUCKET_MAX_BYTES) {
    throw new Error(
      `GM_setValue("${key}") rejected: "${scriptId}" would store ~${Math.round(bucketSize / 1024)} KB, the limit is ${GM_BUCKET_MAX_BYTES / 1024} KB`,
    );
  }

  all[scriptId] = next;
  await gmValuesItem.setValue(all);
}

export async function gmDelete(scriptId: string, key: string): Promise<void> {
  const all = await gmValuesItem.getValue();
  if (all[scriptId]) {
    delete all[scriptId][key];
    await gmValuesItem.setValue(all);
  }
}

export async function gmList(scriptId: string): Promise<string[]> {
  const all = await gmValuesItem.getValue();
  return Object.keys(all[scriptId] ?? {});
}
