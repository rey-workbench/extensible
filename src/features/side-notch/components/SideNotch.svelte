<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { browser } from "wxt/browser";
  import { tempMailApi } from "@/features/temp-mail/api";
  import { USER_SCRIPTS_ACTIONS } from "@/features/user-scripts/constants/user-scripts.constants";
  import { APP_ACTIONS, APP_COMMANDS, COPY_MESSAGES, copyWithFeedback } from "@/lib/browser";
  import {
    type FeatureModule,
    getFeatureColor,
    getToggleableFeatures,
  } from "@/lib/feature-registry";
  import { createFeatureToggles, watchFeatureToggles } from "@/lib/feature-toggles.svelte";
  import { sendMessage } from "@/lib/messaging";
  import { showToast } from "@/lib/toast";
  import globalCss from "@/styles/global.css?inline";
  import BentoLauncher from "./BentoLauncher.svelte";
  import DrawerDetail from "./DrawerDetail.svelte";
  import NotchHandle from "./NotchHandle.svelte";

  const logo48 = browser.runtime.getURL("/icon/icon-48.png");
  const logo32 = browser.runtime.getURL("/icon/icon-32.png");

  interface Props {
    shadowRoot: ShadowRoot;
  }
  let { shadowRoot }: Props = $props();

  const modules = getToggleableFeatures();

  let isOpen = $state(false);
  let activeTempAddress = $state<string | null>(null);
  let isGeneratingMail = $state(false);

  let view = $state<"list" | "detail">("list");
  let activeId = $state<string | null>(null);
  
  let hasOpened = $state(false);
  const toggles = createFeatureToggles(modules);
  const enabledMap = $derived(toggles.enabledMap);
  const masterOn = $derived(toggles.masterOn);
  let scriptStats = $state<{ total: number; enabled: number }>({ total: 0, enabled: 0 });

  async function loadScriptStats(): Promise<void> {
    try {
      const scripts = await sendMessage<{ enabled: boolean }[]>(
        USER_SCRIPTS_ACTIONS.LIST,
      );
      scriptStats = {
        total: scripts.length,
        enabled: scripts.filter((s) => s.enabled).length,
      };
    } catch {
      scriptStats = { total: 0, enabled: 0 };
    }
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
    const message = await copyWithFeedback(activeTempAddress);
    showToast(shadowRoot, message, {
      isError: message !== COPY_MESSAGES.success,
      durationMs: 1500,
    });
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && isOpen) {
      e.stopPropagation();
      closeDrawer();
    }
  }

  onDestroy(() => {
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
      .ext-notch-handle-wrapper {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2147483645;
        width: 34px;
        height: 120px;
        border-radius: 16px 0 0 16px;
        background: var(--color-ext-glass);
        backdrop-filter: blur(16px);
        border: 1px solid var(--color-ext-border);
        border-right: none;
        box-shadow: -4px 10px 30px -4px rgba(15, 23, 42, 0.12), -1px 0 3px rgba(15, 23, 42, 0.04);
        box-sizing: border-box;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, background 0.2s ease;
      }
      .ext-notch-handle-wrapper:hover {
        transform: translateY(-50%) translateX(-4px);
        background: var(--color-ext-surface);
        box-shadow: -6px 14px 36px -4px rgba(15, 23, 42, 0.18);
      }
    `;
    shadowRoot.appendChild(style);

    
    
    watchFeatureToggles(toggles);

    
    
    browser.runtime.onMessage.addListener(
      (msg: { action?: string; payload?: Record<string, unknown> } | undefined) => {
        if (!msg) return;
        if (msg.action === APP_ACTIONS.OPEN_LAUNCHER) {
          void handleDeepOpen(msg.payload ?? {});
          return;
        }
        if (msg.action === APP_ACTIONS.COMMAND) {
          const command = (msg.payload as { command?: string } | undefined)?.command;
          
          
          if (command === APP_COMMANDS.TOGGLE_DOCK) {
            if (isOpen) closeDrawer();
            else openDrawer();
          } else if (command === APP_COMMANDS.COPY_TEMP_EMAIL) {
            void handleQuickCopy();
          }
        }
      },
    );
  });

  type ModuleApi = {
    openEditorFor?: (scriptId: string) => void;
    installFromCapturedUrl?: (url: string) => void;
  };

  let moduleApi = $state<ModuleApi | null>(null);

  async function handleDeepOpen(payload: Record<string, unknown>): Promise<void> {
    const featureId = typeof payload.feature === "string" ? payload.feature : null;
    const editId = typeof payload.editId === "string" ? payload.editId : null;
    const installUrl = typeof payload.installUrl === "string" ? payload.installUrl : null;

    if (featureId) {
      openDetail(featureId);
    } else if (!isOpen) {
      openDrawer();
    }

    if (featureId === "user-scripts" && (editId || installUrl)) {
      
      await new Promise((r) => setTimeout(r, 150));
      if (editId) moduleApi?.openEditorFor?.(editId);
      if (installUrl) moduleApi?.installFromCapturedUrl?.(installUrl);
    }
  }


  function openDrawer(): void {
    isOpen = true;
    hasOpened = true;
    void toggles.sync();
    void syncTempMail();
    void loadScriptStats();
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
    hasOpened = true;
    void toggles.sync();
    if (id === "temp-mail") void syncTempMail();
  }

  function showList(): void {
    view = "list";
    void loadScriptStats();
  }
</script>

<div
  class="ext-notch-root select-none text-sm"
  style="font-family: 'Plus Jakarta Sans', 'Inter', system-ui, 'Segoe UI', Roboto, Ubuntu, sans-serif; font-size: 14px; line-height: 1.5; color: var(--color-ext-text);"
>
  <div
    class="ext-notch-handle-wrapper {isOpen
      ? 'pointer-events-none opacity-0'
      : 'opacity-100'}"
    role="region"
    aria-label="Extensible Notch"
  >
    <NotchHandle {logo32} {masterOn} onOpen={openDrawer} />
  </div>

  <div
    class="fixed inset-0 z-2147483646 flex items-center justify-center p-4 md:p-8 overflow-y-auto bg-ext-bg/75 backdrop-blur-xl transition-all duration-300 {isOpen
      ? 'pointer-events-auto opacity-100'
      : 'pointer-events-none opacity-0'}"
    role="presentation"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeDrawer();
    }}
    onkeydown={(e) => e.key === "Escape" && closeDrawer()}
  >
    <div
      class="relative w-full max-w-5xl transition-all duration-300 ease-out {isOpen
        ? 'scale-100 opacity-100 translate-y-0'
        : 'scale-95 opacity-0 translate-y-4'}"
      role="dialog"
      aria-label="Extensible Hub"
    >
      {#if hasOpened}
        {#if view === "list"}
        <BentoLauncher
          {logo48}
          features={modules}
          {enabledMap}
          {masterOn}
          {activeTempAddress}
          {isGeneratingMail}
          {scriptStats}
          onToggleAll={(v) => void toggles.toggleAll(v)}
          onClose={closeDrawer}
          onOpenDetail={openDetail}
          onToggleFeature={(m, enabled) => void toggles.toggle(m.id, enabled)}
          onQuickGenerate={() => void handleQuickGenerate()}
          onQuickCopy={() => void handleQuickCopy()}
        />
      {:else}
          <DrawerDetail
            feature={activeModule}
            onBack={showList}
            onClose={closeDrawer}
            onModuleApi={(api) => (moduleApi = api)}
          />
        {/if}
      {/if}
    </div>
  </div>
</div>
