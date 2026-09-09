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
        return "#D63230";
      case "ai-exporter":
        return "#2D8C4E";
      default:
        return "#1B4DDB";
    }
  }
</script>

<svelte:window
  onclick={() => (activeDropdownId = null)}
  onkeydown={(e) => e.key === "Escape" && (activeDropdownId = null)}
/>

<div
  class="ext-container flex h-full min-h-0 flex-col select-none bg-ext-bg text-ext-text"
>
  {#if view === "list"}
    <!-- Header -->
    <header
      class="flex h-10.5 shrink-0 items-center justify-between border-b-[1.5px] border-ext-border bg-ext-surface px-3"
    >
      <!-- Brand -->
      <div class="flex items-center gap-2">
        <span
          class="flex h-5.5 w-5.5 items-center justify-center rounded-[5px] border-[1.5px] border-ext-primary-dark bg-ext-primary text-white shadow-[1px_1px_0_#1A1A1A]"
        >
          <Icon name="puzzle" size={13} />
        </span>
        <span class="text-[13px] font-bold uppercase tracking-wider text-ext-text">
          Extensible
        </span>
      </div>

      <!-- Right: Master Toggle -->
      <div class="flex items-center gap-1.5">
        <span
          class="text-[10.5px] font-bold uppercase tracking-wider text-ext-muted"
        >{masterOn ? "All on" : "All off"}</span>
        <button
          type="button"
          class="relative h-4.5 w-8 cursor-pointer rounded-sm border-[1.5px] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ext-primary/40 focus-visible:ring-offset-1 {masterOn
            ? 'bg-ext-success border-[#1E6B38]'
            : 'bg-[#D4CEC2] border-ext-muted'}"
          title={masterOn ? "Disable all extensions" : "Enable all extensions"}
          aria-label="Toggle all extensions"
          onclick={() => toggleAll(!masterOn)}
        >
          <span
            class="absolute top-[1.5px] h-3.25 w-3.25 rounded-[3px] bg-white shadow-[1px_1px_0_rgba(26,26,26,0.2)] transition-all duration-200 {masterOn
              ? 'left-3.75'
              : 'left-0.5'}"
          ></span>
        </button>
      </div>
    </header>

    <!-- Search Input -->
    <div class="border-b-[1.5px] border-ext-border bg-ext-surface px-2.5 pb-2.5 pt-2">
      <div
        class="flex h-7.5 items-center gap-1.5 rounded-md border-[1.5px] border-ext-border bg-ext-surface px-2.5 transition-all focus-within:ring-2 focus-within:ring-ext-primary/20"
      >
        <button
          type="button"
          class="flex cursor-pointer items-center text-ext-muted hover:text-ext-text"
          title="Search"
          aria-label="Search"
          onclick={focusSearch}
        >
          <Icon name="search" size={13} />
        </button>
        <input
          bind:this={searchInput}
          type="text"
          class="h-full min-w-0 flex-1 border-0 bg-transparent text-[12px] font-medium text-ext-text outline-none"
          placeholder="Search extensions..."
          autocomplete="off"
          spellcheck="false"
          bind:value={query}
        />
        {#if query}
          <button
            type="button"
            class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-[3px] bg-[#EDE7DA] text-[9px] font-bold text-ext-text-secondary transition-colors hover:bg-[#D4CEC2] hover:text-ext-text"
            aria-label="Clear search"
            onclick={() => (query = "")}>&times;</button
          >
        {/if}
      </div>
    </div>

    <!-- Category Header Bar -->
    <div
      class="flex h-6.5 items-center justify-between px-3"
    >
      <span
        class="text-[10.5px] font-bold uppercase tracking-widest text-ext-muted"
      >
        Extensions
      </span>
      <span
        class="rounded-sm border border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-px text-[9.5px] font-bold tabular-nums text-ext-text-secondary"
      >{filtered.length}</span>
    </div>

    <!-- Extension List -->
    <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
      {#if filtered.length === 0}
        <div
          class="flex flex-col items-center gap-2 px-3 py-10 text-center"
        >
          <span
            class="flex h-10 w-10 items-center justify-center rounded-md border-[1.5px] border-[#D4CEC2] bg-[#EDE7DA] text-ext-muted"
          >
            <Icon name="puzzle" size={18} />
          </span>
          <div class="text-[12.5px] font-bold text-ext-text">
            {query ? "No matches" : "No extensions"}
          </div>
          <div class="text-[11px] text-ext-text-secondary">
            {query ? "Try a different search term" : "Nothing to show here yet"}
          </div>
        </div>
      {:else}
        {#each filtered as feature (feature.id)}
          {@const enabled = enabledMap[feature.id] !== false}
          <div
            class="group flex cursor-pointer items-center gap-2.5 rounded-lg border-[1.5px] border-ext-border bg-ext-surface px-2 py-1.5 shadow-[2px_2px_0_#1A1A1A] transition-all {enabled
              ? 'hover:bg-[#EDE7DA] hover:shadow-[3px_3px_0_#1A1A1A] active:shadow-[1px_1px_0_#1A1A1A] active:translate-x-px active:translate-y-px'
              : 'opacity-55 hover:opacity-75'} {activeDropdownId === feature.id
              ? 'relative z-20 bg-[#EDE7DA] shadow-[3px_3px_0_#1A1A1A]'
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
            <!-- App Icon -->
            <span
              class="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-white shadow-[1px_1px_0_#1A1A1A] transition-transform group-hover:scale-105"
              style="background: {getFeatureColor(feature.id)}; border-color: {getFeatureColor(feature.id)}; {enabled
                ? ''
                : 'filter: grayscale(100%); opacity: 0.55;'}"
            >
              <Icon name={feature.icon} size={14} />
            </span>

            <!-- Extension Info -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span
                  class="truncate text-[12.5px] font-bold text-ext-text"
                >
                  {feature.name}
                </span>
                {#if !enabled}
                  <span
                    class="shrink-0 rounded-[3px] border border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-ext-muted"
                  >Off</span>
                {/if}
              </div>
              <div
                class="truncate text-[10.5px] text-ext-text-secondary"
              >{feature.description}</div>
            </div>

            <!-- Settings Gear Button & Options Dropdown -->
            <div class="relative">
              <button
                type="button"
                class="flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text"
                title="Options"
                aria-label="Options for {feature.name}"
                onclick={(e) => {
                  e.stopPropagation();
                  activeDropdownId =
                    activeDropdownId === feature.id ? null : feature.id;
                }}
              >
                <Icon name="gear" size={13} />
              </button>

              {#if activeDropdownId === feature.id}
                <div
                  class="ext-menu absolute right-0 top-full z-50 mt-1 min-w-32.5 text-[12px]"
                  role="menu"
                  tabindex="-1"
                  onclick={(e) => e.stopPropagation()}
                  onkeydown={(e) => e.stopPropagation()}
                >
                  {#if feature.popup}
                    <button
                      type="button"
                      class="ext-menu-item text-ext-text"
                      onclick={() => {
                        activeDropdownId = null;
                        openDetail(feature.id);
                      }}
                    >
                      <Icon name="gear" size={12} class="opacity-60" />
                      <span>Details</span>
                    </button>
                    <div
                      class="mx-2 my-1 h-px bg-ext-border/20"
                    ></div>
                  {/if}
                  <button
                    type="button"
                    class="ext-menu-item {enabled
                      ? 'text-ext-danger'
                      : 'text-ext-success'}"
                    onclick={() => {
                      activeDropdownId = null;
                      toggleFeature(feature, !enabled);
                    }}
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full {enabled
                        ? 'bg-ext-danger'
                        : 'bg-ext-success'}"
                    ></span>
                    <span>{enabled ? "Disable" : "Enable"}</span>
                  </button>
                </div>
              {/if}
            </div>

            <!-- Navigable affordance -->
            {#if feature.popup}
              <svg
                class="h-3.5 w-3.5 shrink-0 text-ext-muted transition-all group-hover:translate-x-0.5 group-hover:text-ext-text"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <!-- Detail View -->
    <header
      class="flex h-10.5 shrink-0 items-center justify-between border-b-[1.5px] border-ext-border bg-ext-surface px-3"
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
      <span
        class="max-w-42.5 truncate text-[12.5px] font-bold text-ext-text"
      >
        {activeFeature?.name ?? ""}
      </span>
      <div class="w-14"></div>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if activeFeature?.popup}
        {@const DetailView = activeFeature.popup}
        <DetailView />
      {/if}
    </div>
  {/if}
</div>