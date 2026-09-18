<script lang="ts">
  import { onMount } from "svelte";
  import Badge from "@/components/Badge.svelte";
  import ExtensionList from "@/components/ExtensionList.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import { openBentoLauncher } from "@/lib/browser";
  import { type FeatureModule, getToggleableFeatures } from "@/lib/feature-registry";
  import { createFeatureToggles, watchFeatureToggles } from "@/lib/feature-toggles.svelte";

  
  const features = getToggleableFeatures();

  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);

  const toggles = createFeatureToggles(features);
  const enabledMap = $derived(toggles.enabledMap);
  const masterOn = $derived(toggles.masterOn);

  const activeFeature = $derived(
    activeId ? (features.find((f) => f.id === activeId) ?? null) : null,
  );

  onMount(() => watchFeatureToggles(toggles));

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

</script>

<div class="ext-container flex h-full min-h-0 flex-col select-none bg-ext-bg text-ext-text">
  {#if view === "list"}
    <header
      class="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white px-3"
    >
      <div class="flex items-center gap-2">
        <img
          src="/icon/icon-48.png"
          alt="Extensible Logo"
          class="h-8 w-8 rounded-xl border border-slate-200 bg-white object-contain shadow-sm"
        />
        <span class="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-ext-text">
          Extensible
          {#if import.meta.env.DEV}
            <Badge text="DEV" variant="warning" class="px-2 py-0.5" />
          {/if}
        </span>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          type="button"
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-ext-text active:scale-95"
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
      class="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white px-3"
    >
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1 rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-1.5 text-body font-bold text-ext-text-secondary shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-ext-text"
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
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-ext-text active:scale-95"
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
