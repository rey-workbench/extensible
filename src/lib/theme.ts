import { storage } from "wxt/utils/storage";

export type ThemePreference = "system" | "light" | "dark";

export type ColorScheme = "light" | "dark" | "light dark";

export const THEME_STORAGE_KEY = "local:app:theme";

export const THEME_ORDER: readonly ThemePreference[] = ["system", "light", "dark"];

const themeItem = storage.defineItem<ThemePreference>(THEME_STORAGE_KEY, {
  defaultValue: "system",
});

export function getThemePreference(): Promise<ThemePreference> {
  return themeItem.getValue();
}

export function setThemePreference(preference: ThemePreference): Promise<void> {
  return themeItem.setValue(preference);
}

export function colorSchemeFor(preference: ThemePreference): ColorScheme {
  return preference === "system" ? "light dark" : preference;
}

export function nextTheme(preference: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(preference);
  return THEME_ORDER[index < 0 ? 0 : (index + 1) % THEME_ORDER.length];
}

export function supportsTheming(): boolean {
  return typeof CSS !== "undefined" && CSS.supports("color", "light-dark(#fff, #000)");
}

const bound = new WeakSet<HTMLElement>();

export function applyTheme(root: HTMLElement, preference: ThemePreference): void {
  if (!supportsTheming()) return;
  root.style.colorScheme = colorSchemeFor(preference);
}

export function bindTheme(root: HTMLElement): void {
  if (bound.has(root)) return;
  bound.add(root);

  applyTheme(root, "system");
  void getThemePreference().then((preference) => applyTheme(root, preference));
  themeItem.watch((preference) => {
    if (root.isConnected) applyTheme(root, preference);
  });
}
