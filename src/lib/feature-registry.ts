import type { Component } from "svelte";
import type { IconName } from "@/lib/icons";

export interface FeatureModule {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  mandatory?: boolean;
  background?: () => void | Promise<void>;
  content?: () => void | Promise<void>;
  popup?: Component;
  color?: string;
}

const registry = new Map<string, FeatureModule>();

export function defineFeature(module: FeatureModule): void {
  if (registry.has(module.id)) {
    throw new Error(`[FeatureRegistry] Duplicate feature id "${module.id}"`);
  }
  registry.set(module.id, module);
}

export function getFeatures(): FeatureModule[] {
  return [...registry.values()];
}

export function getToggleableFeatures(): FeatureModule[] {
  return [...registry.values()].filter((f) => !f.mandatory);
}

export function getFeatureColor(id: string): string {
  return registry.get(id)?.color ?? "#1B4DDB";
}
