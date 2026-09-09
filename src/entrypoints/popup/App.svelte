<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@/components/Icon.svelte";
  import { type FeatureModule, getToggleableFeatures } from "@/lib/feature-registry";
  import {
    featureEnabledItem,
    setFeatureEnabled,
    setFeaturesEnabled,
  } from "@/lib/feature-settings";

  // Mandatory (host) features like Side Notch are always enabled — hide them from the list.
  const features = getToggleableFeatures();

  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);
  let query = $state("");
  let masterOn = $state(true);
  let enabledMap = $state<Record<string, boolean>>({});
  let searchInput = $state<HTMLInputElement | null>(null);
  let activeDropdownId = $state<string | null>(null);

  const filtered = $derived(
    features.filter((f) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      );
    }),
  );

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

  async function toggleFeature(
    feature: FeatureModule,
    enabled: boolean,
  ): Promise<void> {
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

  function focusSearch(): void {
    view = "list";
    searchInput?.focus();
  }

  function openDetail(id: string): void {
    if (!features.some((f) => f.id === id && f.popup)) return;
    activeId = id;
    view = "detail";
  }

  function showList(): void {
    view = "list";
  }

  function getFeatureColor(id: string): string {
    switch (id) {
      case "temp-mail":
        return "#ea4335";
      case "ai-exporter":
        return "#10b981";
      default:
        return "#2563eb";
    }
  }
</script>

<svelte:window
  onclick={() => (activeDropdownId = null)}
  onkeydown={(e) => e.key === "Escape" && (activeDropdownId = null)}
/>

<div
  class="ext-container flex h-full min-h-0 flex-col select-none bg-white text-slate-800"
>
  {#if view === "list"}
    <!-- Header: Extensible Branding + Toolbar -->
    <header
      class="flex h-[36px] items-center justify-between bg-white px-2.5 py-1"
    >
      <!-- Left: Logo & Brand Name -->
      <div class="flex cursor-default items-center gap-1.5">
        <!-- Extensible-style spiral logo badge -->
        <svg
          class="h-[20px] w-[20px] shrink-0 rounded-[3px] shadow-xs"
          viewBox="0 0 24 24"
        >
          <rect width="24" height="24" rx="4" fill="#1b3668" />
          <path
            d="M12 4a8 8 0 108 8 1 1 0 10-2 0 6 6 0 11-6-6 1 1 0 100-2zm0 4a4 4 0 104 4 1 1 0 10-2 0 2 2 0 11-2-2 1 1 0 100-2z"
            fill="#ffffff"
          />
        </svg>
        <span
          class="text-[16px] font-bold leading-none tracking-tight text-[#21407a]"
        >
          Extensible
        </span>
      </div>

      <!-- Right: Toolbar Action Icons -->
      <div class="flex items-center">
        <!-- Master Switch (Oval Outline Toggle) -->
        <button
          type="button"
          class="relative h-[14px] w-[26px] cursor-pointer rounded-full border-[1.5px] border-[#475569] bg-white transition-colors focus:outline-none"
          title={masterOn ? "Disable all extensions" : "Enable all extensions"}
          aria-label="Toggle all extensions"
          onclick={() => toggleAll(!masterOn)}
        >
          <span
            class="absolute top-[1.5px] h-[8px] w-[8px] rounded-full bg-[#334155] transition-all duration-150 {masterOn
              ? 'right-[2px]'
              : 'left-[2px]'}"
          ></span>
        </button>
      </div>
    </header>

    <!-- Search Input Bar -->
    <div
      class="flex h-[30px] items-center gap-2 border-t border-b border-[#e2e8f0] bg-white px-2.5"
    >
      <button
        type="button"
        class="flex cursor-pointer items-center text-[#6b7280] hover:text-[#374151]"
        title="Search"
        aria-label="Search"
        onclick={focusSearch}
      >
        <Icon name="search" size={14} />
      </button>
      <input
        bind:this={searchInput}
        type="text"
        class="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#1f2937] outline-none placeholder:text-transparent"
        placeholder=""
        autocomplete="off"
        spellcheck="false"
        bind:value={query}
      />
      {#if query}
        <button
          type="button"
          class="cursor-pointer text-xs text-[#9ca3af] hover:text-[#4b5563]"
          aria-label="Clear search"
          onclick={() => (query = "")}>&times;</button
        >
      {/if}
    </div>

    <!-- Category Header Bar (Steel Blue Gradient) -->
    <div
      class="flex h-[24px] items-center border-t border-[#7d9dc6] border-b border-[#2d476e] px-2.5 text-[12px] font-bold text-white shadow-xs"
      style="background: linear-gradient(180deg, #6c8cb8 0%, #466795 50%, #3a5b88 100%); text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);"
    >
      Extensions
    </div>

    <!-- Extension List -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if filtered.length === 0}
        <div class="px-3 py-6 text-center text-xs text-[#9ca3af]">
          No extensions found.
        </div>
      {:else}
        {#each filtered as feature (feature.id)}
          {@const enabled = enabledMap[feature.id] !== false}
          <div
            class="flex h-[29px] cursor-pointer items-center gap-2 px-2.5 transition-colors {enabled
              ? 'bg-white hover:bg-[#f8f9fa]'
              : 'bg-[#f4f4f4] hover:bg-[#eaeaea]'} {activeDropdownId ===
            feature.id
              ? 'relative z-20'
              : ''}"
            role="button"
            tabindex="0"
            title="{feature.name}{enabled ? '' : ' (Disabled)'}"
            onclick={() => {
              activeDropdownId = null;
              if (feature.popup) openDetail(feature.id);
            }}
            onkeydown={(e) =>
              e.key === "Enter" && feature.popup && openDetail(feature.id)}
          >
            <!-- Extension Icon -->
            <span
              class="flex h-4.5 w-4.5 shrink-0 items-center justify-center transition-opacity"
              style="color: {getFeatureColor(feature.id)}; {enabled
                ? ''
                : 'filter: grayscale(100%); opacity: 0.35;'}"
            >
              <Icon name={feature.icon} size={17} />
            </span>

            <!-- Extension Title -->
            <span
              class="min-w-0 flex-1 truncate text-[13px] leading-tight {enabled
                ? 'font-normal text-[#111827]'
                : 'text-[#9e9e9e]'}"
            >
              {feature.name}
            </span>

            <!-- Settings Gear Button & Options Dropdown -->
            <div class="relative">
              <button
                type="button"
                class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[#707070] transition-colors hover:bg-slate-200 hover:text-[#111827]"
                title="Options"
                aria-label="Options for {feature.name}"
                onclick={(e) => {
                  e.stopPropagation();
                  activeDropdownId =
                    activeDropdownId === feature.id ? null : feature.id;
                }}
              >
                <Icon name="gear" size={14} />
              </button>

              {#if activeDropdownId === feature.id}
                <div
                  class="absolute right-0 top-full z-50 mt-1 min-w-[110px] rounded border border-slate-200 bg-white py-1 shadow-lg text-[12px] text-slate-700"
                  role="menu"
                  tabindex="-1"
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => e.stopPropagation()}
                >
                  {#if feature.popup}
                    <button
                      type="button"
                      class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      onclick={() => {
                        activeDropdownId = null;
                        openDetail(feature.id);
                      }}
                    >
                      <Icon name="gear" size={12} class="text-slate-400" />
                      <span>Detail</span>
                    </button>
                  {/if}
                  <button
                    type="button"
                    class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-slate-100 {enabled
                      ? 'text-red-600'
                      : 'text-emerald-600'}"
                    onclick={() => {
                      activeDropdownId = null;
                      toggleFeature(feature, !enabled);
                    }}
                  >
                    <span
                      class="h-2 w-2 rounded-full {enabled
                        ? 'bg-red-500'
                        : 'bg-emerald-500'}"
                    ></span>
                    <span>{enabled ? "Disable" : "Enable"}</span>
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <!-- Detail View (Extensible Gradient Header) -->
    <div
      class="ext-gradient-bar flex h-[26px] shrink-0 items-center justify-between px-2.5 text-white"
    >
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1 text-[12px] font-bold text-white transition-opacity hover:opacity-85"
        onclick={showList}
      >
        <span class="text-sm font-bold leading-none">&#8249;</span>
        <span>Extensions</span>
      </button>
      <span class="max-w-[170px] truncate text-[12px] font-bold text-white/95">
        {activeFeature?.name ?? ""}
      </span>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if activeFeature?.popup}
        {@const DetailView = activeFeature.popup}
        <DetailView />
      {/if}
    </div>
  {/if}
</div>
