<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@/components/Icon.svelte";
  import { type FeatureModule, getToggleableFeatures } from "@/lib/feature-registry";
  import {
    featureEnabledItem,
    setFeatureEnabled,
    setFeaturesEnabled,
  } from "@/lib/feature-settings";
  import globalCss from "@/styles/global.css?inline";

  interface Props {
    /** The shadow root the drawer is mounted into (Tailwind utilities are injected here). */
    shadowRoot: ShadowRoot;
  }
  let { shadowRoot }: Props = $props();

  // Don't list ourselves (or other mandatory host features) in the drawer.
  const modules = getToggleableFeatures();

  let isOpen = $state(false);
  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);
  let query = $state("");
  let masterOn = $state(true);
  let enabledMap = $state<Record<string, boolean>>({});
  let searchInput = $state<HTMLInputElement | null>(null);
  let activeDropdownId = $state<string | null>(null);

  const filtered = $derived(
    modules.filter((m) => {
      const q = query.trim().toLowerCase();
      return !q || m.name.toLowerCase().includes(q) || m.id.includes(q);
    }),
  );

  const activeModule = $derived(
    activeId ? (modules.find((m) => m.id === activeId) ?? null) : null,
  );

  onMount(() => {
    // Tailwind utilities + theme + preflight for everything inside the shadow root.
    const style = document.createElement("style");
    style.textContent = `
      ${globalCss}
      ::-webkit-scrollbar { width: 9px; }
      ::-webkit-scrollbar-track { background: #f1f1f1; }
      ::-webkit-scrollbar-thumb { background: #c1c1c1; }
      ::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
    `;
    shadowRoot.appendChild(style);

    void syncFromStorage();
    void featureEnabledItem.watch(() => void syncFromStorage());
  });

  async function syncFromStorage(): Promise<void> {
    const map = await featureEnabledItem.getValue();
    enabledMap = map ?? {};
    masterOn = modules.every((m) => enabledMap[m.id] !== false);
  }

  async function toggleFeature(id: string, enabled: boolean): Promise<void> {
    enabledMap = { ...enabledMap, [id]: enabled };
    await setFeatureEnabled(id, enabled);
  }

  async function toggleAll(enabled: boolean): Promise<void> {
    masterOn = enabled;
    await setFeaturesEnabled(
      modules.map((m) => m.id),
      enabled,
    );
    await syncFromStorage();
  }

  function openDrawer(): void {
    isOpen = true;
    void syncFromStorage();
  }

  function closeDrawer(): void {
    isOpen = false;
    view = "list";
  }

  function openDetail(id: string): void {
    const target = modules.find((m) => m.id === id);
    if (!target?.popup) return;
    activeId = id;
    view = "detail";
  }

  function showList(): void {
    view = "list";
  }

  function focusSearch(): void {
    view = "list";
    searchInput?.focus();
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
  class="aio-notch-root [font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif]"
>
  <!-- Floating Notch Handle -->
  <button
    type="button"
    class="group fixed right-0 top-1/2 z-2147483645 flex h-13 w-9.5 -translate-y-1/2 cursor-pointer select-none items-center justify-center rounded-l-xl border border-r-0 border-white/15 bg-linear-to-br from-slate-800 to-slate-900 shadow-[-4px_0_16px_rgba(0,0,0,0.35)] transition-all duration-300 hover:w-11.5 hover:from-blue-500 hover:to-blue-700 hover:shadow-[-6px_0_20px_rgba(59,130,246,0.5)] {isOpen
      ? 'pointer-events-none opacity-0'
      : ''}"
    title="Extensible - Click to open"
    aria-label="Open Extensible drawer"
    onclick={openDrawer}
  >
    <span
      class="absolute left-2 top-2 h-1.75 w-1.75 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"
    ></span>
    <svg
      class="h-4.5 w-4.5 fill-none stroke-slate-100 transition-transform duration-200 group-hover:scale-110"
      viewBox="0 0 24 24"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M4 12h7a3.5 3.5 0 10-1.2 2.6" />
      <path d="M14 8.5l6 7M14 15.5l6-7" />
    </svg>
  </button>

  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-2147483646 bg-slate-900/50 backdrop-blur-[3px] transition-opacity duration-300 {isOpen
      ? 'pointer-events-auto opacity-100'
      : 'pointer-events-none opacity-0'}"
    role="presentation"
    tabindex="-1"
    onclick={closeDrawer}
    onkeydown={(e) => e.key === "Escape" && closeDrawer()}
  ></div>

  <!-- Slide-out Drawer (Extensible Style) -->
  <div
    class="fixed right-0 top-0 z-2147483647 flex h-full w-[330px] max-w-[90vw] flex-col overflow-hidden border-l border-slate-300 bg-white text-slate-800 shadow-[-8px_0_25px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out {isOpen
      ? 'translate-x-0'
      : 'translate-x-full'}"
    role="dialog"
    aria-label="Extensible drawer"
  >
    {#if view === "list"}
      <!-- Header: Extensible Branding + Toolbar -->
      <header
        class="flex h-[36px] shrink-0 items-center justify-between bg-white px-2.5 py-1"
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
        <div class="flex items-center gap-1.5">
          <!-- Master Switch (Oval Outline Toggle) -->
          <button
            type="button"
            class="relative h-[14px] w-[26px] cursor-pointer rounded-full border-[1.5px] border-[#475569] bg-white transition-colors focus:outline-none"
            title={masterOn
              ? "Disable all extensions"
              : "Enable all extensions"}
            aria-label="Toggle all extensions"
            onclick={() => toggleAll(!masterOn)}
          >
            <span
              class="absolute top-[1.5px] h-[8px] w-[8px] rounded-full bg-[#334155] transition-all duration-150 {masterOn
                ? 'right-[2px]'
                : 'left-[2px]'}"
            ></span>
          </button>

          <!-- Close Drawer button -->
          <button
            type="button"
            class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-base leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
            title="Close panel"
            aria-label="Close panel"
            onclick={closeDrawer}>&times;</button
          >
        </div>
      </header>

      <!-- Search Input Bar -->
      <div
        class="flex h-[30px] shrink-0 items-center gap-2 border-t border-b border-[#e2e8f0] bg-white px-2.5"
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
        class="flex h-[24px] shrink-0 items-center border-t border-[#7d9dc6] border-b border-[#2d476e] px-2.5 text-[12px] font-bold text-white shadow-xs"
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
          {#each filtered as mod (mod.id)}
            {@const enabled = enabledMap[mod.id] !== false}
            <div
              class="flex h-[29px] cursor-pointer items-center gap-2 px-2.5 transition-colors {enabled
                ? 'bg-white hover:bg-[#f8f9fa]'
                : 'bg-[#f4f4f4] hover:bg-[#eaeaea]'} {activeDropdownId ===
              mod.id
                ? 'relative z-20'
                : ''}"
              role="button"
              tabindex="0"
              title="{mod.name}{enabled ? '' : ' (Disabled)'}"
              onclick={() => {
                activeDropdownId = null;
                if (mod.popup) openDetail(mod.id);
              }}
              onkeydown={(e) =>
                e.key === "Enter" && mod.popup && openDetail(mod.id)}
            >
              <!-- Extension Icon -->
              <span
                class="flex h-4.5 w-4.5 shrink-0 items-center justify-center transition-opacity"
                style="color: {getFeatureColor(mod.id)}; {enabled
                  ? ''
                  : 'filter: grayscale(100%); opacity: 0.35;'}"
              >
                <Icon name={mod.icon} size={17} />
              </span>

              <!-- Extension Title -->
              <span
                class="min-w-0 flex-1 truncate text-[13px] leading-tight {enabled
                  ? 'font-normal text-[#111827]'
                  : 'text-[#9e9e9e]'}"
              >
                {mod.name}
              </span>

              <!-- Settings Gear Button & Options Dropdown -->
              <div class="relative">
                <button
                  type="button"
                  class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[#707070] transition-colors hover:bg-slate-200 hover:text-[#111827]"
                  title="Options"
                  aria-label="Options for {mod.name}"
                  onclick={(e) => {
                    e.stopPropagation();
                    activeDropdownId =
                      activeDropdownId === mod.id ? null : mod.id;
                  }}
                >
                  <Icon name="gear" size={14} />
                </button>

                {#if activeDropdownId === mod.id}
                  <div
                    class="absolute right-0 top-full z-50 mt-1 min-w-[110px] rounded border border-slate-200 bg-white py-1 shadow-lg text-[12px] text-slate-700"
                    role="menu"
                    tabindex="-1"
                    onclick={(e) => e.stopPropagation()}
                    onkeydown={(e) => e.stopPropagation()}
                  >
                    {#if mod.popup}
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        onclick={() => {
                          activeDropdownId = null;
                          openDetail(mod.id);
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
                        toggleFeature(mod.id, !enabled);
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
        <div class="flex items-center gap-1">
          <span
            class="max-w-[170px] truncate text-[12px] font-bold text-white/95"
          >
            {activeModule?.name ?? ""}
          </span>
          <button
            type="button"
            class="ml-1 cursor-pointer text-xs text-white/70 hover:text-white"
            title="Close"
            onclick={closeDrawer}>&times;</button
          >
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if activeModule?.popup}
          {@const DetailView = activeModule.popup}
          <DetailView />
        {/if}
      </div>
    {/if}
  </div>
</div>
