<script lang="ts">
  import { onMount } from "svelte";
  import Badge from "@/components/Badge.svelte";
  import ExtensionList from "@/components/ExtensionList.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import {
    type FeatureModule,
    getFeatureColor,
    getToggleableFeatures,
  } from "@/lib/feature-registry";
  import {
    featureEnabledItem,
    setFeatureEnabled,
    setFeaturesEnabled,
  } from "@/lib/feature-settings";

  
  const features = getToggleableFeatures();

  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);
  let masterOn = $state(true);
  let enabledMap = $state<Record<string, boolean>>({});

  const activeFeature = $derived(
    activeId ? (features.find((f) => f.id === activeId) ?? null) : null,
  );

  onMount(async () => {
    await syncFromStorage();
    void featureEnabledItem.watch(() => void syncFromStorage());
  });

  async function syncFromStorage(): Promise<void> {
    const map = await featureEnabledItem.getValue();
    enabledMap = map ?? {};
    masterOn = features.every((f) => enabledMap[f.id] !== false);
  }

  async function toggleFeature(feature: FeatureModule, enabled: boolean): Promise<void> {
    enabledMap = { ...enabledMap, [feature.id]: enabled };
    await setFeatureEnabled(feature.id, enabled);
  }

  async function toggleAll(enabled: boolean): Promise<void> {
    masterOn = enabled;
    await setFeaturesEnabled(
      features.map((f) => f.id),
      enabled,
    );
    await syncFromStorage();
  }

  function openDetail(id: string): void {
    if (!features.some((f) => f.id === id && f.popup)) return;
    activeId = id;
    view = "detail";
  }

  function showList(): void {
    view = "list";
  }

  async function openDashboardTab(): Promise<void> {
    const targetUrl = chrome.runtime.getURL("/dashboard.html");
    const allTabs = await chrome.tabs.query({});
    const existingTab = allTabs.find((t) => t.url?.includes("/dashboard.html"));

    if (existingTab?.id != null) {
      await chrome.tabs.update(existingTab.id, { active: true });
      if (existingTab.windowId != null) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url: targetUrl });
    }
  }
</script>

<div class="ext-container flex h-full min-h-0 flex-col select-none bg-ext-bg text-ext-text">
  {#if view === "list"}
    <header
      class="flex h-10.5 shrink-0 items-center justify-between border-b-[1.5px] border-solid border-ext-border bg-ext-surface px-3"
    >
      <div class="flex items-center gap-2">
        <img
          src="/icon/icon-48.png"
          alt="Extensible Logo"
          class="h-6 w-6 rounded-[5px] border-[1.5px] border-solid border-ext-border bg-ext-surface object-contain shadow-[1.5px_1.5px_0_#1A1A1A]"
        />
        <span class="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-ext-text">
          Extensible
          {#if import.meta.env.DEV}
            <Badge text="DEV" variant="warning" class="px-1 py-0 text-[9px] leading-3" />
          {/if}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-solid border-ext-border bg-[#EDE7DA] text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-colors hover:bg-white"
          title="Open Dashboard in full tab"
          onclick={() => void openDashboardTab()}
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>

        <span
          class="text-[10.5px] font-bold uppercase tracking-wider text-ext-muted"
        >{masterOn ? "All on" : "All off"}</span>
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
      colorFor={getFeatureColor}
      onOpenDetail={openDetail}
      onToggleFeature={(f, enabled) => void toggleFeature(f, enabled)}
    />
  {:else}
    <header
      class="flex h-10.5 shrink-0 items-center justify-between border-b-[1.5px] border-solid border-ext-border bg-ext-surface px-3"
    >
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1 rounded-[5px] py-1 pr-2 text-[12.5px] font-bold uppercase tracking-wide text-ext-text-secondary transition-colors hover:bg-[#EDE7DA] hover:text-ext-text"
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
      <span class="max-w-42.5 truncate text-[12.5px] font-bold text-ext-text">
        {activeFeature?.name ?? ""}
      </span>
      <button
        type="button"
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-solid border-ext-border bg-[#EDE7DA] text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-colors hover:bg-white"
        title="Open Dashboard in full tab"
        onclick={() => void openDashboardTab()}
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