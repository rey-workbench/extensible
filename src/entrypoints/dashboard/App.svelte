<script lang="ts">
  import { onMount } from "svelte";
  import Badge from "@/components/Badge.svelte";
  import Icon from "@/components/Icon.svelte";
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

  let activeTab = $state<string>("overview");
  let masterOn = $state(true);
  let enabledMap = $state<Record<string, boolean>>({});

  const activeFeature = $derived(
    activeTab !== "overview"
      ? (features.find((f) => f.id === activeTab) ?? null)
      : null,
  );

  const activeCount = $derived(
    features.filter((f) => enabledMap[f.id] !== false).length,
  );

  async function syncFromStorage(): Promise<void> {
    const raw = (await featureEnabledItem.getValue()) ?? {};
    const map: Record<string, boolean> = {};
    for (const f of features) {
      map[f.id] = raw[f.id] ?? true;
    }
    enabledMap = map;
    masterOn = features.every((f) => map[f.id] !== false);
  }

  async function toggleFeature(
    feature: FeatureModule,
    enabled: boolean,
  ): Promise<void> {
    enabledMap[feature.id] = enabled;
    await setFeatureEnabled(feature.id, enabled);
    masterOn = features.every((f) => enabledMap[f.id] !== false);
  }

  async function toggleAll(enabled: boolean): Promise<void> {
    masterOn = enabled;
    const next: Record<string, boolean> = {};
    for (const f of features) {
      next[f.id] = enabled;
      enabledMap[f.id] = enabled;
    }
    await setFeaturesEnabled(
      features.map((f) => f.id),
      enabled,
    );
  }

  function checkUrlParams(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get("installUrl")) {
      activeTab = "user-scripts";
    }
  }

  onMount(() => {
    void syncFromStorage();
    void featureEnabledItem.watch(() => void syncFromStorage());

    checkUrlParams();
    window.addEventListener("popstate", checkUrlParams);
    return () => {
      window.removeEventListener("popstate", checkUrlParams);
    };
  });
</script>

<div
  class="flex h-screen w-screen overflow-hidden bg-ext-bg font-sans text-ext-text select-none"
>
  <!-- Left Sidebar -->
  <aside
    class="flex w-64 shrink-0 flex-col border-r-[1.5px] border-solid border-ext-border bg-ext-surface"
  >
    <!-- Brand Header -->
    <div
      class="flex h-14 items-center justify-between border-b-[1.5px] border-solid border-ext-border px-4"
    >
      <div class="flex items-center gap-2.5">
        <img
          src="/icon/icon-48.png"
          alt="Extensible Logo"
          class="h-7 w-7 rounded-[6px] border-[1.5px] border-solid border-ext-border bg-ext-surface object-contain shadow-[1.5px_1.5px_0_#1A1A1A]"
        />
        <div class="flex flex-col">
          <span
            class="flex items-center gap-1.5 text-[14px] font-bold uppercase tracking-wider text-ext-text leading-tight"
          >
            Extensible
            {#if import.meta.env.DEV}
              <Badge
                text="DEV"
                variant="warning"
                class="px-1 py-0 text-[8.5px] leading-3"
              />
            {/if}
          </span>
          <span class="text-[10px] font-medium text-ext-text-secondary"
            >Dashboard</span
          >
        </div>
      </div>
    </div>

    <!-- Nav List -->
    <div class="flex-1 overflow-y-auto p-3 space-y-1">
      <button
        type="button"
        class="flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-[12.5px] font-bold uppercase tracking-wide transition-all {activeTab ===
        'overview'
          ? 'border-ext-border bg-[#EDE7DA] shadow-[1.5px_1.5px_0_#1A1A1A]'
          : 'border-transparent text-ext-text-secondary hover:border-ext-border/40 hover:bg-[#EDE7DA]/50 hover:text-ext-text'}"
        onclick={() => (activeTab = "overview")}
      >
        <div class="flex items-center gap-2.5">
          <svg
            class="h-4 w-4 text-ext-text"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
          <span>Overview</span>
        </div>
        <Badge
          text="{activeCount}/{features.length}"
          variant="neutral"
          class="text-[9.5px]"
        />
      </button>

      <div class="my-2 border-t border-solid border-ext-border/60"></div>
      <div
        class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ext-text-secondary"
      >
        Installed Modules
      </div>

      {#each features as feature (feature.id)}
        {@const isEnabled = enabledMap[feature.id] !== false}
        {@const color = getFeatureColor(feature.id)}
        <div
          class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12.5px] font-bold uppercase tracking-wide transition-all {activeTab ===
          feature.id
            ? 'border-ext-border bg-[#EDE7DA] shadow-[1.5px_1.5px_0_#1A1A1A]'
            : 'border-transparent text-ext-text-secondary hover:border-ext-border/40 hover:bg-[#EDE7DA]/50 hover:text-ext-text'}"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 bg-transparent border-0 p-0 text-left text-inherit font-inherit"
            onclick={() => (activeTab = feature.id)}
          >
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-solid border-ext-border text-white shadow-[1px_1px_0_#1A1A1A]"
              style="background-color: {color};"
            >
              <Icon name={feature.icon} size={13} />
            </div>
            <span class="truncate text-[12px]">{feature.name}</span>
          </button>
          <div class="flex items-center gap-1.5 shrink-0">
            <Toggle
              checked={isEnabled}
              label={isEnabled
                ? `Disable ${feature.name}`
                : `Enable ${feature.name}`}
              onchange={(val) => void toggleFeature(feature, val)}
            />
          </div>
        </div>
      {/each}
    </div>

    <!-- Master Switch Footer -->
    <div
      class="border-t-[1.5px] border-solid border-ext-border bg-[#EDE7DA]/70 p-3"
    >
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span
            class="text-[11.5px] font-bold uppercase tracking-wider text-ext-text"
          >
            Master Power
          </span>
          <span class="text-[10px] text-ext-text-secondary">
            {masterOn ? "All modules enabled" : "All modules paused"}
          </span>
        </div>
        <Toggle
          checked={masterOn}
          label={masterOn ? "Disable all" : "Enable all"}
          onchange={(val) => void toggleAll(val)}
        />
      </div>
    </div>
  </aside>

  <!-- Main Content Area -->
  <main class="flex flex-1 flex-col overflow-hidden">
    <!-- Top Header -->
    <header
      class="flex h-14 shrink-0 items-center justify-between border-b-[1.5px] border-solid border-ext-border bg-ext-surface px-6"
    >
      <div class="flex items-center gap-2">
        <span
          class="text-[12px] font-bold uppercase tracking-wider text-ext-text-secondary"
          >Dashboard</span
        >
        <span class="text-ext-text-secondary">/</span>
        <span
          class="text-[13px] font-bold uppercase tracking-wider text-ext-text"
        >
          {activeTab === "overview"
            ? "Overview"
            : (activeFeature?.name ?? "Module")}
        </span>
      </div>

      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-1.5 text-[11px] font-semibold text-ext-text-secondary"
        >
          <span
            class="h-2 w-2 rounded-full {masterOn
              ? 'bg-emerald-500'
              : 'bg-amber-500'}"
          ></span>
          <span>{activeCount} Active</span>
        </div>
      </div>
    </header>

    <!-- Body Content -->
    <div class="flex-1 overflow-y-auto p-6">
      {#if activeTab === "overview"}
        <div class="mx-auto max-w-5xl space-y-6">
          <!-- Overview Banner -->
          <div
            class="rounded-xl border-[1.5px] border-solid border-ext-border bg-gradient-to-r from-[#EDE7DA] to-[#f2ede4] p-6 shadow-[2px_2px_0_#1A1A1A]"
          >
            <div class="flex items-center justify-between">
              <div>
                <h1
                  class="text-xl font-bold uppercase tracking-wide text-ext-text"
                >
                  Extensible Workspace
                </h1>
                <p class="mt-1 text-sm text-ext-text-secondary">
                  Manage all modular browser extension tools in one unified
                  dashboard tab.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <Badge
                  text="{activeCount} Enabled"
                  variant="success"
                  class="px-2.5 py-1 text-[11px]"
                />
                {#if import.meta.env.DEV}
                  <Badge
                    text="Mode: DEV"
                    variant="warning"
                    class="px-2.5 py-1 text-[11px]"
                  />
                {/if}
              </div>
            </div>
          </div>

          <!-- Feature Cards Grid -->
          <div>
            <h2
              class="mb-3 text-xs font-bold uppercase tracking-wider text-ext-text-secondary"
            >
              Available Modules
            </h2>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each features as feature (feature.id)}
                {@const isEnabled = enabledMap[feature.id] !== false}
                {@const color = getFeatureColor(feature.id)}
                <div
                  class="flex flex-col justify-between rounded-xl border-[1.5px] border-solid border-ext-border bg-ext-surface p-4 shadow-[2px_2px_0_#1A1A1A] transition-all hover:translate-y-[-1px]"
                >
                  <div>
                    <div class="flex items-center justify-between">
                      <div
                        class="flex h-9 w-9 items-center justify-center rounded-lg border border-solid border-ext-border text-white shadow-[1.5px_1.5px_0_#1A1A1A]"
                        style="background-color: {color};"
                      >
                        <Icon name={feature.icon} size={18} />
                      </div>
                      <Toggle
                        checked={isEnabled}
                        label={isEnabled
                          ? `Disable ${feature.name}`
                          : `Enable ${feature.name}`}
                        onchange={(val) => void toggleFeature(feature, val)}
                      />
                    </div>
                    <h3
                      class="mt-3 text-sm font-bold uppercase tracking-wide text-ext-text"
                    >
                      {feature.name}
                    </h3>
                    <p
                      class="mt-1 text-xs text-ext-text-secondary line-clamp-2"
                    >
                      {feature.description}
                    </p>
                  </div>

                  <div
                    class="mt-4 pt-3 border-t border-solid border-ext-border/40 flex items-center justify-between"
                  >
                    <span
                      class="text-[10.5px] font-bold uppercase tracking-wider {isEnabled
                        ? 'text-emerald-700'
                        : 'text-ext-text-secondary'}"
                    >
                      {isEnabled ? "Active" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      class="cursor-pointer rounded border border-solid border-ext-border bg-[#EDE7DA] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-colors hover:bg-white"
                      onclick={() => (activeTab = feature.id)}
                    >
                      Open Module &rarr;
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else if activeFeature?.popup}
        {@const DetailView = activeFeature.popup}
        <div class="w-full">
          <DetailView />
        </div>
      {/if}
    </div>
  </main>
</div>
