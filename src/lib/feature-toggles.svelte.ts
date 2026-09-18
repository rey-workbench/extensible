import type { FeatureModule } from "./feature-registry";
import {
  featureEnabledItem,
  isEnabledIn,
  setFeatureEnabled,
  setFeaturesEnabled,
} from "./feature-settings";

export function createFeatureToggles(features: readonly FeatureModule[]) {
  let enabledMap = $state<Record<string, boolean>>({});
  const masterOn = $derived(features.every((f) => isEnabledIn(enabledMap, f.id)));

  async function sync(): Promise<void> {
    enabledMap = (await featureEnabledItem.getValue()) ?? {};
  }

  async function toggle(id: string, enabled: boolean): Promise<void> {
    enabledMap = { ...enabledMap, [id]: enabled };
    await setFeatureEnabled(id, enabled);
  }

  async function toggleAll(enabled: boolean): Promise<void> {
    await setFeaturesEnabled(
      features.map((f) => f.id),
      enabled,
    );
    await sync();
  }

  return {
    sync,
    toggle,
    toggleAll,
    get enabledMap(): Record<string, boolean> {
      return enabledMap;
    },
    get masterOn(): boolean {
      return masterOn;
    },
  };
}

export type FeatureToggles = ReturnType<typeof createFeatureToggles>;

export function watchFeatureToggles(toggles: FeatureToggles): void {
  void toggles.sync();
  void featureEnabledItem.watch(() => void toggles.sync());
}
