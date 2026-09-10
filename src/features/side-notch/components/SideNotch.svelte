<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { browser } from "wxt/browser";
  import Icon from "@/components/Icon.svelte";
  import { TEMPMAIL_ACTIONS } from "@/features/temp-mail/constants/temp-mail.constants";
  import type { TempEmail, TempMailCurrentState } from "@/features/temp-mail/types/temp-mail.types";
  import { copyToClipboard } from "@/lib/browser";
  import { type FeatureModule, getToggleableFeatures } from "@/lib/feature-registry";
  import {
    featureEnabledItem,
    setFeatureEnabled,
    setFeaturesEnabled,
  } from "@/lib/feature-settings";
  import { sendMessage } from "@/lib/messaging";
  import globalCss from "@/styles/global.css?inline";

  const logo48 = browser.runtime.getURL("/icon/icon-48.png");
  const logo32 = browser.runtime.getURL("/icon/icon-32.png");

  interface Props {
    /** The shadow root the drawer is mounted into (Tailwind utilities are injected here). */
    shadowRoot: ShadowRoot;
  }
  let { shadowRoot }: Props = $props();

  // Don't list ourselves (or other mandatory host features) in the drawer.
  const modules = getToggleableFeatures();

  let isOpen = $state(false);
  let isHovered = $state(false);
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  let activeTempAddress = $state<string | null>(null);
  let isGeneratingMail = $state(false);
  let quickToast = $state<string | null>(null);

  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);
  let query = $state("");
  let masterOn = $state(true);
  let enabledMap = $state<Record<string, boolean>>({});
  let searchInput = $state<HTMLInputElement | null>(null);
  let activeDropdownId = $state<string | null>(null);

  function onNotchMouseEnter(): void {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    isHovered = true;
    void syncTempMail();
  }

  function onNotchMouseLeave(): void {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      isHovered = false;
    }, 320);
  }

  async function syncTempMail(): Promise<void> {
    try {
      const state = await sendMessage<TempMailCurrentState>(
        TEMPMAIL_ACTIONS.GET_CURRENT,
        { autoGenerate: false }
      );
      activeTempAddress = state?.email?.address ?? null;
    } catch {
      // Background idle
    }
  }

  async function handleQuickGenerate(e: MouseEvent): Promise<void> {
    e.stopPropagation();
    if (isGeneratingMail) return;
    isGeneratingMail = true;
    try {
      const res = await sendMessage<TempEmail>(TEMPMAIL_ACTIONS.GENERATE_NEW);
      if (res?.address) {
        activeTempAddress = res.address;
        quickToast = "Created!";
        setTimeout(() => (quickToast = null), 1500);
      }
    } finally {
      isGeneratingMail = false;
    }
  }

  async function handleQuickCopy(e: MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!activeTempAddress) {
      await handleQuickGenerate(e);
      return;
    }
    const ok = await copyToClipboard(activeTempAddress);
    if (ok) {
      quickToast = "Copied!";
      setTimeout(() => (quickToast = null), 1500);
    }
  }

  onDestroy(() => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
  });

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
      .ext-quick-dock {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2147483645;
        background: #FFFDF7;
        border: 2px solid #1A1A1A;
        border-right: none;
        box-shadow: -3px 3px 0 #1A1A1A;
        transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    border-radius 0.3s ease,
                    box-shadow 0.3s ease;
        box-sizing: border-box;
        overflow: hidden;
      }
      .ext-quick-dock.is-idle {
        width: 30px;
        height: 112px;
        border-radius: 6px 0 0 6px;
        cursor: pointer;
      }
      .ext-quick-dock.is-idle:hover {
        width: 34px;
        box-shadow: -4px 4px 0 #1A1A1A;
      }
      .ext-quick-dock.is-expanded {
        width: 384px;
        height: 196px;
        border-radius: 8px 0 0 8px;
        box-shadow: -5px 5px 0 #1A1A1A;
      }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #A89B8C; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: #8A7D6F; }
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
    isOpen = true;
    void syncFromStorage();
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
        return "#D63230";
      case "ai-toolkit":
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
  class="aio-notch-root select-none"
  style="font-family: 'Space Grotesk', system-ui, 'Segoe UI', Roboto, Ubuntu, sans-serif;"
>
  <!-- Quick Dock (floating right-edge panel) -->
  <div
    class="ext-quick-dock group {isHovered ? 'is-expanded' : 'is-idle'} {isOpen
      ? 'pointer-events-none opacity-0'
      : 'opacity-100'}"
    role="region"
    aria-label="Extensible quick access panel"
    onmouseenter={onNotchMouseEnter}
    onmouseleave={onNotchMouseLeave}
  >
    {#if isHovered}
      <!-- Expanded Quick Dock Content -->
      <div
        class="flex h-full w-full flex-col justify-between p-3 text-ext-text"
      >
        <!-- Top Row: Brand + Master Switch + Full Panel Button -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img
              src={logo48}
              alt="Extensible Logo"
              class="h-6 w-6 rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface object-contain shadow-[1.5px_1.5px_0_#1A1A1A]"
            />
            <div class="flex flex-col leading-tight">
              <span class="text-[12.5px] font-black uppercase tracking-tight text-ext-text">Extensible</span>
              <span class="text-[8.5px] font-bold uppercase tracking-wider text-ext-text-secondary">Quick Access</span>
            </div>
          </div>

          <!-- Right Controls: Toggle + Expand Button -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="relative h-4.5 w-8 cursor-pointer rounded-sm border-[1.5px] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ext-primary/40 focus-visible:ring-offset-1 {masterOn
                ? 'bg-ext-success border-[#1E6B38]'
                : 'bg-[#D4CEC2] border-ext-muted'}"
              title={masterOn ? "Turn Extensions OFF" : "Turn Extensions ON"}
              onclick={(e) => {
                e.stopPropagation();
                toggleAll(!masterOn);
              }}
            >
              <span
                class="absolute top-[1.5px] h-3.25 w-3.25 rounded-[3px] bg-white shadow-[1px_1px_0_rgba(26,26,26,0.2)] transition-all duration-200 {masterOn
                  ? 'left-3.75'
                  : 'left-0.5'}"
              ></span>
            </button>

            <!-- Expand Full Drawer Button -->
            <button
              type="button"
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
              title="Open Full Extensions Panel"
              onclick={(e) => {
                e.stopPropagation();
                isHovered = false;
                openDrawer();
              }}
            >
              <svg
                class="h-3 w-3 fill-none stroke-current"
                viewBox="0 0 24 24"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Middle 2-Column Cards Grid -->
        <div class="grid grid-cols-2 gap-2 my-1.5">
          <!-- Card 1: Temp Mail -->
          <div
            class="flex flex-col justify-between rounded-lg border-[1.5px] border-ext-border bg-ext-surface p-2 shadow-[2px_2px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA]"
          >
            <div class="flex items-center gap-1.5">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-[#A82624] bg-ext-danger text-white shadow-[1px_1px_0_#1A1A1A]"
              >
                <Icon name="mail" size={12} />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-[10.5px] font-bold uppercase tracking-wide text-ext-text leading-tight">
                  Temp Mail
                </div>
                <div class="truncate text-[9px] font-mono text-ext-muted">
                  {activeTempAddress ? activeTempAddress : "No active address"}
                </div>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="mt-1.5 flex items-center justify-between border-t border-ext-border/25 pt-1.5">
              <div class="flex items-center gap-1">
                <!-- Generate / Refresh Button -->
                <button
                  type="button"
                  class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
                  title="Generate New Address"
                  onclick={handleQuickGenerate}
                >
                  <Icon
                    name="refresh"
                    size={10}
                    class={isGeneratingMail ? "animate-spin" : ""}
                  />
                </button>

                <!-- Copy Button -->
                <button
                  type="button"
                  class="flex h-5 cursor-pointer items-center gap-1 rounded-sm border-[1.5px] border-ext-border bg-ext-surface px-2 text-[9px] font-bold uppercase tracking-wide text-ext-text-secondary transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
                  title="Copy Address"
                  onclick={handleQuickCopy}
                >
                  <Icon name="copy" size={9} />
                  <span>{quickToast || "Copy"}</span>
                </button>
              </div>

              <!-- Jump to Inbox Detail -->
              <button
                type="button"
                class="cursor-pointer text-[9.5px] font-bold uppercase tracking-wide text-ext-primary transition-colors hover:text-ext-primary-dark"
                onclick={(e) => {
                  e.stopPropagation();
                  isHovered = false;
                  openDetail("temp-mail");
                }}
              >
                Inbox ›
              </button>
            </div>
          </div>

          <!-- Card 2: AI Toolkit -->
          <div
            class="flex flex-col justify-between rounded-lg border-[1.5px] border-ext-border bg-ext-surface p-2 shadow-[2px_2px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA]"
          >
            <div class="flex items-center gap-1.5">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-[#1E6B38] bg-ext-success text-white shadow-[1px_1px_0_#1A1A1A]"
              >
                <Icon name="markdown" size={12} />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-[10.5px] font-bold uppercase tracking-wide text-ext-text leading-tight">
                  AI Toolkit
                </div>
                <div class="truncate text-[9px] text-ext-muted">
                  {modules.filter((m) => enabledMap[m.id] !== false).length} extensions active
                </div>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="mt-1.5 flex items-center justify-between border-t border-ext-border/25 pt-1.5">
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1 rounded-sm border-[1.5px] border-[#C48C1E] bg-[#FDF3E3] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#C48C1E] transition-all hover:bg-[#F8E5C4] active:translate-x-px active:translate-y-px"
                onclick={(e) => {
                  e.stopPropagation();
                  isHovered = false;
                  openDetail("ai-toolkit");
                }}
              >
                <span>Caveman</span>
              </button>

              <button
                type="button"
                class="cursor-pointer text-[9.5px] font-bold uppercase tracking-wide text-ext-primary transition-colors hover:text-ext-primary-dark"
                onclick={(e) => {
                  e.stopPropagation();
                  isHovered = false;
                  openDetail("ai-toolkit");
                }}
              >
                Export ›
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom Footer -->
        <button
          type="button"
          class="flex w-full cursor-pointer items-center justify-between border-0 border-t border-ext-border/25 bg-transparent pt-1 text-[9.5px] font-bold uppercase tracking-wide text-ext-muted outline-none transition-colors hover:text-ext-text"
          onclick={(e) => {
            e.stopPropagation();
            isHovered = false;
            openDrawer();
          }}
        >
          <span>Quick access panel</span>
          <span class="flex items-center gap-0.5 text-ext-text-secondary hover:text-ext-text">
            Open panel →
          </span>
        </button>
      </div>
    {:else}
      <!-- Bauhaus Graphic Edge Tab (Anti-Slop Craft) -->
      <button
        type="button"
        class="relative flex h-full w-full flex-col items-center justify-between border-0 bg-ext-surface p-0 cursor-pointer outline-none overflow-hidden group/handle select-none"
        onclick={openDrawer}
        aria-label="Open Extensible panel"
        title="Open Extensible (Click for drawer, hover for quick panel)"
      >
        <!-- Top Status Pip -->
        <div class="flex flex-col items-center pt-2">
          <span
            class="h-2.5 w-2.5 rounded-full border-[1.5px] border-ext-border transition-colors duration-200 {masterOn
              ? 'bg-ext-success'
              : 'bg-ext-muted'}"
            title={masterOn ? "All active" : "Disabled"}
          ></span>
        </div>

        <!-- Center Typography & Tactile Grip Lines -->
        <div class="flex flex-col items-center gap-1.5 py-1">
          <div class="flex flex-col items-center gap-0.75 opacity-60">
            <span class="h-[1.5px] w-3 rounded-full bg-ext-border"></span>
            <span class="h-[1.5px] w-3 rounded-full bg-ext-border"></span>
          </div>

          <span
            class="text-[9px] font-black uppercase tracking-[0.25em] text-ext-text [writing-mode:vertical-rl] rotate-180"
          >
            EXT
          </span>

          <div class="flex flex-col items-center gap-0.75 opacity-60">
            <span class="h-[1.5px] w-3 rounded-full bg-ext-border"></span>
          </div>
        </div>

        <!-- Bottom Bauhaus Anchor Block with New Logo -->
        <div
          class="flex h-8 w-full items-center justify-center border-t-2 border-ext-border bg-ext-surface p-1 transition-colors group-hover/handle:bg-[#EDE7DA]"
        >
          <img
            src={logo32}
            alt="Extensible Logo"
            class="h-5 w-5 object-contain"
          />
        </div>
      </button>
    {/if}
  </div>

  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-2147483646 bg-ext-text/40 backdrop-blur-[2px] transition-opacity duration-300 {isOpen
      ? 'pointer-events-auto opacity-100'
      : 'pointer-events-none opacity-0'}"
    role="presentation"
    tabindex="-1"
    onclick={closeDrawer}
    onkeydown={(e) => e.key === "Escape" && closeDrawer()}
  ></div>

  <!-- Slide-out Drawer -->
  <div
    class="fixed right-0 top-0 z-2147483647 flex h-full w-82.5 max-w-[90vw] flex-col overflow-hidden border-l-[1.5px] border-ext-border bg-ext-bg text-ext-text shadow-[-4px_4px_0_#1A1A1A] transition-transform duration-300 ease-out {isOpen
      ? 'translate-x-0'
      : 'translate-x-full'}"
    role="dialog"
    aria-label="Extensible drawer"
  >
    {#if view === "list"}
      <!-- Header -->
      <header
        class="flex h-10.5 shrink-0 items-center justify-between border-b-[1.5px] border-ext-border bg-ext-surface px-3"
      >
        <!-- Brand -->
        <div class="flex items-center gap-2">
          <img
            src={logo48}
            alt="Extensible Logo"
            class="h-6 w-6 rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface object-contain shadow-[1.5px_1.5px_0_#1A1A1A]"
          />
          <span
            class="text-[13px] font-bold uppercase tracking-wider text-ext-text"
          >
            Extensible
          </span>
        </div>

        <!-- Right: Toolbar Action Icons -->
        <div class="flex items-center gap-2">
          <!-- Master Switch -->
          <span
            class="text-[10.5px] font-bold uppercase tracking-wider text-ext-muted"
          >{masterOn ? "All on" : "All off"}</span>
          <button
            type="button"
            class="relative h-4.5 w-8 cursor-pointer rounded-sm border-[1.5px] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ext-primary/40 focus-visible:ring-offset-1 {masterOn
              ? 'bg-ext-success border-[#1E6B38]'
              : 'bg-[#D4CEC2] border-ext-muted'}"
            title={masterOn
              ? "Disable all extensions"
              : "Enable all extensions"}
            aria-label="Toggle all extensions"
            onclick={() => toggleAll(!masterOn)}
          >
            <span
              class="absolute top-[1.5px] h-3.25 w-3.25 rounded-[3px] bg-white shadow-[1px_1px_0_rgba(26,26,26,0.2)] transition-all duration-200 {masterOn
                ? 'left-3.75'
                : 'left-0.5'}"
            ></span>
          </button>

          <!-- Close Drawer button -->
          <button
            type="button"
            class="flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
            title="Close panel"
            aria-label="Close panel"
            onclick={closeDrawer}
          >
            &times;
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
              class="flex h-10 w-10 items-center justify-center rounded-md border-2 border-ext-border bg-[#EDE7DA] p-1.5 shadow-[2px_2px_0_#1A1A1A]"
            >
              <img
                src={logo48}
                alt="Extensible"
                class="h-full w-full object-contain"
              />
            </span>
            <div class="text-[12.5px] font-bold text-ext-text">
              {query ? "No matches" : "No extensions"}
            </div>
            <div class="text-[11px] text-ext-text-secondary">
              {query ? "Try a different search term" : "Nothing to show here yet"}
            </div>
          </div>
        {:else}
          {#each filtered as mod (mod.id)}
            {@const enabled = enabledMap[mod.id] !== false}
            <div
              class="group flex cursor-pointer items-center gap-2.5 rounded-lg border-[1.5px] border-ext-border bg-ext-surface px-2 py-1.5 shadow-[2px_2px_0_#1A1A1A] transition-all {enabled
                ? 'hover:bg-[#EDE7DA] hover:shadow-[3px_3px_0_#1A1A1A] active:shadow-[1px_1px_0_#1A1A1A] active:translate-x-px active:translate-y-px'
                : 'opacity-55 hover:opacity-75'} {activeDropdownId === mod.id
                ? 'relative z-20 bg-[#EDE7DA] shadow-[3px_3px_0_#1A1A1A]'
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
              <!-- App Icon -->
              <span
                class="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-white shadow-[1px_1px_0_#1A1A1A] transition-transform group-hover:scale-105"
                style="background: {getFeatureColor(mod.id)}; border-color: {getFeatureColor(mod.id)}; {enabled
                  ? ''
                  : 'filter: grayscale(100%); opacity: 0.55;'}"
              >
                <Icon name={mod.icon} size={14} />
              </span>

              <!-- Extension Info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span
                    class="truncate text-[12.5px] font-bold text-ext-text"
                  >
                    {mod.name}
                  </span>
                  {#if !enabled}
                    <span
                      class="shrink-0 rounded-[3px] border border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-ext-muted"
                    >Off</span>
                  {/if}
                </div>
                <div
                  class="truncate text-[10.5px] text-ext-text-secondary"
                >{mod.description}</div>
              </div>

              <!-- Settings Gear Button & Options Dropdown -->
              <div class="relative">
                <button
                  type="button"
                  class="flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text"
                  title="Options"
                  aria-label="Options for {mod.name}"
                  onclick={(e) => {
                    e.stopPropagation();
                    activeDropdownId =
                      activeDropdownId === mod.id ? null : mod.id;
                  }}
                >
                  <Icon name="gear" size={13} />
                </button>

                {#if activeDropdownId === mod.id}
                  <div
                    class="ext-menu absolute right-0 top-full z-50 mt-1 min-w-32.5 text-[12px]"
                    role="menu"
                    tabindex="-1"
                    onclick={(e) => e.stopPropagation()}
                    onkeydown={(e) => e.stopPropagation()}
                  >
                    {#if mod.popup}
                      <button
                        type="button"
                        class="ext-menu-item text-ext-text"
                        onclick={() => {
                          activeDropdownId = null;
                          openDetail(mod.id);
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
                        toggleFeature(mod.id, !enabled);
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
              {#if mod.popup}
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
        <div class="flex items-center gap-1.5">
          <span
            class="max-w-37.5 truncate text-[12.5px] font-bold text-ext-text"
          >
            {activeModule?.name ?? ""}
          </span>
          <button
            type="button"
            class="flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
            title="Close"
            onclick={closeDrawer}>&times;</button
          >
        </div>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if activeModule?.popup}
          {@const DetailView = activeModule.popup}
          <DetailView />
        {/if}
      </div>
    {/if}
  </div>
</div>