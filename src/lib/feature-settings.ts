import { storage } from "wxt/utils/storage";

const FEATURE_ENABLED_STORAGE_KEY = "local:feature:enabled";

export const featureEnabledItem = storage.defineItem<Record<string, boolean>>(
  FEATURE_ENABLED_STORAGE_KEY,
  { defaultValue: {} }
);

/** Features default to enabled until explicitly switched off. */
export async function isFeatureEnabled(id: string): Promise<boolean> {
  const map = await featureEnabledItem.getValue();
  return map[id] !== false;
}

/** Persists the enable/disable state of a single feature. */
export async function setFeatureEnabled(id: string, enabled: boolean): Promise<void> {
  const map = await featureEnabledItem.getValue();
  await featureEnabledItem.setValue({ ...map, [id]: enabled });
}

/** Persists the enable/disable state of several features at once (master toggle). */
export async function setFeaturesEnabled(ids: string[], enabled: boolean): Promise<void> {
  const map = await featureEnabledItem.getValue();
  const next = { ...map };
  for (const id of ids) next[id] = enabled;
  await featureEnabledItem.setValue(next);
}
