<script lang="ts">
  import { onMount } from "svelte";
  import Badge from "@/components/Badge.svelte";
  import ExtensionList from "@/components/ExtensionList.svelte";
  import Icon from "@/components/Icon.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import { openBentoLauncher } from "@/lib/browser";
  import { type FeatureModule, getToggleableFeatures } from "@/lib/feature-registry";
  import { createFeatureToggles, watchFeatureToggles } from "@/lib/feature-toggles.svelte";
  import type { IconName } from "@/lib/icons";
  import {
    applyTheme,
    bindTheme,
    getThemePreference,
    nextTheme,
    setThemePreference,
    type ThemePreference,
  } from "@/lib/theme";
  import { clearAllStoredData } from "@/lib/utils";

  const THEME_ICON: Record<ThemePreference, IconName> = {
    system: "auto",
    light: "sun",
    dark: "moon",
  };
  const THEME_LABEL: Record<ThemePreference, string> = {
    system: "System",
    light: "Light",
    dark: "Dark",
  };

  
  const features = getToggleableFeatures();

  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);

  const toggles = createFeatureToggles(features);
  const enabledMap = $derived(toggles.enabledMap);
  const masterOn = $derived(toggles.masterOn);

  const activeFeature = $derived(
    activeId ? (features.find((f) => f.id === activeId) ?? null) : null,
  );

  let themePref = $state<ThemePreference>("system");

  onMount(() => {
    bindTheme(document.documentElement);
    void getThemePreference().then((preference) => (themePref = preference));
    return watchFeatureToggles(toggles);
  });

  async function cycleTheme(): Promise<void> {
    const next = nextTheme(themePref);
    themePref = next;
    
    
    applyTheme(document.documentElement, next);
    await setThemePreference(next);
  }

  function toggleFeature(feature: FeatureModule, enabled: boolean): void {
    void toggles.toggle(feature.id, enabled);
  }

  function toggleAll(enabled: boolean): void {
    void toggles.toggleAll(enabled);
  }

  function openDetail(id: string): void {
    if (!features.some((f) => f.id === id && f.popup)) return;
    activeId = id;
    view = "detail";
  }

  function showList(): void {
    view = "list";
  }

  async function clearAllData(): Promise<void> {
    const confirmed = window.confirm(
      "Delete all Extensible data?\n\n" +
        "This removes your saved AI chat exports, temporary email address and cached inbox, " +
        "user scripts with their stored GM values and run logs, and every module toggle. " +
        "It cannot be undone.",
    );
    if (!confirmed) return;
    await clearAllStoredData();
    await toggles.sync();
  }

</script>

<div class="ext-container flex h-full min-h-0 flex-col select-none bg-ext-bg text-ext-text">
  {#if view === "list"}
    <header
      class="flex h-12 shrink-0 items-center justify-between border-b border-ext-border/70 bg-ext-surface px-3"
    >
      <div class="flex items-center gap-2">
        <img
          src="/icon/icon-48.png"
          alt="Extensible Logo"
          class="h-8 w-8 rounded-xl border border-ext-border bg-ext-surface object-contain shadow-sm"
        />
        <span class="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-ext-text">
          Extensible
          {#if import.meta.env.DEV}
            <Badge text="DEV" variant="warning" class="px-2 py-0.5" />
          {/if}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-ext-border bg-ext-surface text-ext-text-secondary shadow-sm transition-all hover:border-ext-border-strong hover:bg-ext-subtle hover:text-ext-text active:scale-95"
          title={`Theme: ${THEME_LABEL[themePref]} — click for ${THEME_LABEL[nextTheme(themePref)]}`}
          aria-label={`Theme: ${THEME_LABEL[themePref]}`}
          onclick={() => void cycleTheme()}
        >
          <Icon name={THEME_ICON[themePref]} size={14} />
        </button>

        <button
          type="button"
          class="ext-icon-btn h-8 w-8 rounded-xl shadow-sm"
          title="Delete all stored data"
          aria-label="Delete all stored data"
          onclick={() => void clearAllData()}
        >
          <Icon name="trash" size={14} />
        </button>

        <button
          type="button"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-ext-border bg-ext-surface text-ext-text-secondary shadow-sm transition-all hover:border-ext-border-strong hover:bg-ext-subtle hover:text-ext-text active:scale-95"
          title="Open Bento Hub in current tab"
          onclick={() => void openBentoLauncher()}
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>

        <Toggle
          checked={masterOn}
          label={masterOn ? "Disable all extensions" : "Enable all extensions"}
          onchange={(v) => toggleAll(v)}
        />
      </div>
    </header>

    <ExtensionList
      {features}
      {enabledMap}
      onOpenDetail={openDetail}
      onToggleFeature={(f, enabled) => void toggleFeature(f, enabled)}
    />
  {:else}
    <header
      class="flex h-12 shrink-0 items-center justify-between border-b border-ext-border/70 bg-ext-surface px-3"
    >
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1 rounded-xl border border-ext-border bg-ext-surface py-1.5 pr-3 pl-1.5 text-body font-bold text-ext-text-secondary shadow-sm transition-colors hover:border-ext-border-strong hover:bg-ext-subtle hover:text-ext-text"
        onclick={showList}
      >
        <svg
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>Extensions</span>
      </button>
      <span class="max-w-42.5 truncate text-body font-bold text-ext-text">
        {activeFeature?.name ?? ""}
      </span>
      <button
        type="button"
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-ext-border bg-ext-surface text-ext-text-secondary shadow-sm transition-all hover:border-ext-border-strong hover:bg-ext-subtle hover:text-ext-text active:scale-95"
        title="Open Dashboard in full tab"
        onclick={() => void openBentoLauncher()}
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if activeFeature?.popup}
        {@const DetailView = activeFeature.popup}
        <DetailView />
      {/if}
    </div>
  {/if}
</div>
