<script lang="ts">
  import Icon from "@/components/Icon.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import type { FeatureModule } from "@/lib/feature-registry";

  interface Props {
    logo48: string;
    masterOn: boolean;
    activeTempAddress: string | null;
    isGeneratingMail: boolean;
    modules: FeatureModule[];
    enabledMap: Record<string, boolean>;
    onToggleAll: (enabled: boolean) => void;
    onQuickGenerate: () => void;
    onQuickCopy: () => void;
    onOpenDetail: (id: string) => void;
    onOpenDrawer: () => void;
  }
  let {
    logo48,
    masterOn,
    activeTempAddress,
    isGeneratingMail,
    modules,
    enabledMap,
    onToggleAll,
    onQuickGenerate,
    onQuickCopy,
    onOpenDetail,
    onOpenDrawer,
  }: Props = $props();
</script>

<div class="flex h-full w-full flex-col justify-between p-3 text-ext-text">
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

  <div class="flex items-center gap-2">
    <Toggle
      checked={masterOn}
      label={masterOn ? "Turn Extensions OFF" : "Turn Extensions ON"}
      onchange={(v) => onToggleAll(v)}
    />
    <button
      type="button"
      class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
      title="Open Full Extensions Panel"
      onclick={onOpenDrawer}
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

<div class="my-1.5 grid grid-cols-2 gap-2">
  <div
    class="flex flex-col justify-between rounded-lg border-[1.5px] border-solid border-ext-border bg-ext-surface p-2 shadow-[2px_2px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA]"
  >
    <div class="flex items-center gap-1.5">
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-solid border-[#A82624] bg-ext-danger text-white shadow-[1px_1px_0_#1A1A1A]"
      >
        <Icon name="mail" size={12} />
      </span>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[10.5px] font-bold uppercase tracking-wide text-ext-text leading-tight">
          Temp Mail
        </div>
        <div class="truncate font-mono text-[9px] text-ext-muted">
          {activeTempAddress ? activeTempAddress : "No active address"}
        </div>
      </div>
    </div>

    <div class="mt-1.5 flex items-center justify-between border-t border-solid border-ext-border/25 pt-1.5">
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-solid border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
          title="Generate New Address"
          onclick={onQuickGenerate}
        >
          <Icon
            name="refresh"
            size={10}
            class={isGeneratingMail ? "animate-spin" : ""}
          />
        </button>

        <button
          type="button"
          class="flex h-5 cursor-pointer items-center gap-1 rounded-sm border-[1.5px] border-solid border-ext-border bg-ext-surface px-1.5 text-[9px] font-bold uppercase tracking-wide text-ext-text-secondary shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
          title="Copy Address"
          onclick={onQuickCopy}
        >
          <Icon name="copy" size={9} />
          <span>Copy</span>
        </button>
      </div>

      <button
        type="button"
        class="flex h-5 cursor-pointer items-center rounded-sm border-[1.5px] border-solid border-ext-primary bg-[#EDE7DA] px-1.5 text-[9px] font-bold uppercase tracking-wide text-ext-primary shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-ext-primary hover:text-white active:translate-x-px active:translate-y-px"
        onclick={() => onOpenDetail("temp-mail")}
      >
        Inbox ›
      </button>
    </div>
  </div>

  <div
    class="flex flex-col justify-between rounded-lg border-[1.5px] border-solid border-ext-border bg-ext-surface p-2 shadow-[2px_2px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA]"
  >
    <div class="flex items-center gap-1.5">
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-solid border-[#1E6B38] bg-ext-success text-white shadow-[1px_1px_0_#1A1A1A]"
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

    <div class="mt-1.5 flex items-center justify-between border-t border-solid border-ext-border/25 pt-1.5">
      <button
        type="button"
        class="flex h-5 cursor-pointer items-center gap-1 rounded-sm border-[1.5px] border-solid border-[#C48C1E] bg-[#FDF3E3] px-2 text-[9px] font-bold uppercase tracking-wide text-[#C48C1E] shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#F8E5C4] active:translate-x-px active:translate-y-px"
        onclick={() => onOpenDetail("ai-toolkit")}
      >
        <span>Caveman</span>
      </button>

      <button
        type="button"
        class="flex h-5 cursor-pointer items-center rounded-sm border-[1.5px] border-solid border-ext-primary bg-[#EDE7DA] px-2 text-[9px] font-bold uppercase tracking-wide text-ext-primary shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-ext-primary hover:text-white active:translate-x-px active:translate-y-px"
        onclick={() => onOpenDetail("ai-toolkit")}
      >
        Export ›
      </button>
    </div>
  </div>
</div>

<button
  type="button"
  class="flex w-full cursor-pointer items-center justify-between border-0 border-t border-ext-border/25 bg-transparent pt-1 text-[9.5px] font-bold uppercase tracking-wide text-ext-muted outline-none transition-colors hover:text-ext-text"
  onclick={onOpenDrawer}
>
  <span>Quick access panel</span>
  <span class="flex items-center gap-0.5 text-ext-text-secondary hover:text-ext-text">
    Open panel →
  </span>
</button>
</div>