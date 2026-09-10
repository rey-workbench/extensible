import type { Component } from "svelte";
import type { IconName } from "@/lib/icons";

/**
 * Feature module definition. Every feature self-registers into the shared
 * registry; entrypoints (background / content / popup) iterate registered
 * features instead of hardcoding per-feature setup calls.
 */
export interface FeatureModule {
  /** Stable, unique id — also the storage key for enable/disable state. */
  id: string;
  name: string;
  description: string;
  icon: IconName;
  /**
   * Core/host features (e.g. the drawer shell). Always enabled, hidden from
   * feature lists, and excluded from the master toggle.
   */
  mandatory?: boolean;
  /** Runs once per service-worker start (only when the feature is enabled). */
  background?: () => void | Promise<void>;
  /** Runs per page load in the content-script context. */
  content?: () => void | Promise<void>;
  /** Svelte component rendered by the popup / drawer detail view. */
  popup?: Component;
}

const registry = new Map<string, FeatureModule>();

/** Registers a feature into the shared registry. Call once per feature. */
export function defineFeature(module: FeatureModule): void {
  if (registry.has(module.id)) {
    throw new Error(`[FeatureRegistry] Duplicate feature id "${module.id}"`);
  }
  registry.set(module.id, module);
}

/** All registered features, in registration order. */
export function getFeatures(): FeatureModule[] {
  return [...registry.values()];
}

/** Non-mandatory features — the ones users can toggle in lists. */
export function getToggleableFeatures(): FeatureModule[] {
  return [...registry.values()].filter((f) => !f.mandatory);
}
