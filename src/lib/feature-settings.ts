import { storage } from "wxt/utils/storage";

const FEATURE_ENABLED_STORAGE_KEY = "local:feature:enabled";

export const featureEnabledItem = storage.defineItem<Record<string, boolean>>(
  FEATURE_ENABLED_STORAGE_KEY,
  { defaultValue: {} }
);

export async function isFeatureEnabled(id: string): Promise<boolean> {
  const map = await featureEnabledItem.getValue();
  return map[id] !== false;
}

export async function setFeatureEnabled(id: string, enabled: boolean): Promise<void> {
  const map = await featureEnabledItem.getValue();
  await featureEnabledItem.setValue({ ...map, [id]: enabled });
}

export async function setFeaturesEnabled(ids: string[], enabled: boolean): Promise<void> {
  const map = await featureEnabledItem.getValue();
  const next = { ...map };
  for (const id of ids) next[id] = enabled;
  await featureEnabledItem.setValue(next);
}
