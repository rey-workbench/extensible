import type { Component } from "svelte";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import type { IconName } from "@/lib/icons";

export interface SettingOption {
  value: string;
  label: string;

  hint?: string;
}

interface SettingFieldBase {
  key: string;
  label: string;
  hint?: string;
}

export type SettingField =
  | (SettingFieldBase & { kind: "toggle" })
  | (SettingFieldBase & { kind: "select"; options: SettingOption[] })
  | (SettingFieldBase & { kind: "number"; min?: number; max?: number; step?: number });

export interface FeatureSettingsSchema {
  fields: SettingField[];

  read: () => Promise<Record<string, unknown>>;

  write: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface FeatureModule {
  id: string;
  name: string;

  description?: string;
  icon: IconName;
  mandatory?: boolean;
  background?: () => void | Promise<void>;
  content?: () => void | Promise<void>;
  popup?: Component;
  color?: string;

  settings?: FeatureSettingsSchema;
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
  return registry.get(id)?.color ?? DESIGN_TOKENS.primary;
}
