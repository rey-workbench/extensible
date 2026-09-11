<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { browser } from "wxt/browser";
  import { tempMailApi } from "@/features/temp-mail/api";
  import { copyToClipboard } from "@/lib/browser";
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
  import { showToast } from "@/lib/toast";
  import globalCss from "@/styles/global.css?inline";
  import DrawerDetail from "./DrawerDetail.svelte";
  import DrawerList from "./DrawerList.svelte";
  import NotchHandle from "./NotchHandle.svelte";
  import QuickDock from "./QuickDock.svelte";

  const logo48 = browser.runtime.getURL("/icon/icon-48.png");
  const logo32 = browser.runtime.getURL("/icon/icon-32.png");

  interface Props {
    shadowRoot: ShadowRoot;
  }
  let { shadowRoot }: Props = $props();

  const modules = getToggleableFeatures();

  let isOpen = $state(false);
  let isHovered = $state(false);
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  let activeTempAddress = $state<string | null>(null);
  let isGeneratingMail = $state(false);

  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);
  let masterOn = $state(true);
  let enabledMap = $state<Record<string, boolean>>({});

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
      const state = await tempMailApi.getCurrentState({ autoGenerate: false });
      activeTempAddress = state?.email?.address ?? null;
    } catch {}
  }

  async function handleQuickGenerate(): Promise<void> {
    if (isGeneratingMail) return;
    isGeneratingMail = true;
    try {
      const res = await tempMailApi.generateNewAddress();
      if (res?.address) {
        activeTempAddress = res.address;
        showToast(shadowRoot, "Created!", { durationMs: 1500 });
      }
    } finally {
      isGeneratingMail = false;
    }
  }

  async function handleQuickCopy(): Promise<void> {
    if (!activeTempAddress) {
      await handleQuickGenerate();
      return;
    }
    const ok = await copyToClipboard(activeTempAddress);
    if (ok) showToast(shadowRoot, "Copied!", { durationMs: 1500 });
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && isOpen) {
      e.stopPropagation();
      closeDrawer();
    }
  }

  onDestroy(() => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    window.removeEventListener("keydown", onKeyDown, true);
  });

  const activeModule = $derived(
    activeId ? (modules.find((m) => m.id === activeId) ?? null) : null,
  );

  onMount(() => {
    window.addEventListener("keydown", onKeyDown, true);

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
    isHovered = false;
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
</script>

<div
  class="aio-notch-root select-none text-[14px]"
  style="font-family: 'Space Grotesk', system-ui, 'Segoe UI', Roboto, Ubuntu, sans-serif; font-size: 14px; line-height: 1.5; color: #1A1A1A;"
>
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
      <QuickDock
        {logo48}
        {masterOn}
        {activeTempAddress}
        {isGeneratingMail}
        {modules}
        {enabledMap}
        onToggleAll={(v) => void toggleAll(v)}
        onQuickGenerate={() => void handleQuickGenerate()}
        onQuickCopy={() => void handleQuickCopy()}
        onOpenDetail={(id) => openDetail(id)}
        onOpenDrawer={openDrawer}
      />
    {:else}
      <NotchHandle {logo32} {masterOn} onOpen={openDrawer} />
    {/if}
  </div>

  <div
    class="fixed inset-0 z-2147483646 bg-ext-text/40 backdrop-blur-[2px] transition-opacity duration-300 {isOpen
      ? 'pointer-events-auto opacity-100'
      : 'pointer-events-none opacity-0'}"
    role="presentation"
    tabindex="-1"
    onclick={closeDrawer}
    onkeydown={(e) => e.key === "Escape" && closeDrawer()}
  ></div>

  <div
    class="fixed top-0 right-0 z-2147483647 flex h-full w-82.5 max-w-[90vw] flex-col overflow-hidden border-l-[1.5px] border-ext-border bg-ext-bg text-ext-text shadow-[-4px_4px_0_#1A1A1A] transition-transform duration-300 ease-out"
    style="transform: translateX({isOpen
      ? '0%'
      : '100%'}); pointer-events: {isOpen ? 'auto' : 'none'};"
    role="dialog"
    aria-label="Extensible drawer"
  >
    {#if view === "list"}
      <DrawerList
        {logo48}
        features={modules}
        {enabledMap}
        {masterOn}
        colorFor={getFeatureColor}
        onToggleAll={(v) => void toggleAll(v)}
        onClose={closeDrawer}
        onOpenDetail={openDetail}
        onToggleFeature={(m, enabled) => void toggleFeature(m.id, enabled)}
      />
    {:else}
      <DrawerDetail
        feature={activeModule}
        onBack={showList}
        onClose={closeDrawer}
      />
    {/if}
  </div>
</div>
