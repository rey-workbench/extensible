<script lang="ts">
  import type { FeatureModule } from "@/lib/feature-registry";
  import Icon from "./Icon.svelte";

  interface Props {
    feature: FeatureModule;
    enabled: boolean;

    color: string;
    dropdownOpen: boolean;
    onOpen: () => void;
    onToggle: (enabled: boolean) => void;
    onDropdown: () => void;
  }
  let {
    feature,
    enabled,
    color,
    dropdownOpen,
    onOpen,
    onToggle,
    onDropdown,
  }: Props = $props();
</script>

<div
  class="group flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-sm transition-all {enabled
    ? 'hover:border-blue-400 hover:shadow-md hover:scale-[1.01]'
    : 'opacity-60 hover:opacity-85'} {dropdownOpen
    ? 'relative z-20 border-blue-400 shadow-md'
    : ''}"
  role="button"
  tabindex="0"
  title="{feature.name}{enabled ? '' : ' (Disabled)'}"
  onclick={() => {
    if (dropdownOpen) onDropdown();
    if (feature.popup) onOpen();
  }}
  onkeydown={(e) => e.key === "Enter" && feature.popup && onOpen()}
>
  <span
    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
    style="background: {color}15; color: {color}; {enabled ? '' : 'filter: grayscale(100%); opacity: 0.55;'}"
  >
    <Icon name={feature.icon} size={18} />
  </span>

  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-1.5">
      <span class="truncate text-sm font-bold text-ext-text">
        {feature.name}
      </span>
      {#if !enabled}
        <span
          class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-chip font-bold uppercase tracking-wider text-ext-text-secondary"
          >Off</span
        >
      {/if}
    </div>
    {#if feature.description}
      <div class="truncate text-body font-medium text-ext-text-secondary">
        {feature.description}
      </div>
    {/if}
  </div>

  <div class="relative">
    <button
      type="button"
      class="ext-icon-btn h-7 w-7 shrink-0"
      title="Options"
      aria-label="Options for {feature.name}"
      onclick={(e) => {
        e.stopPropagation();
        onDropdown();
      }}
    >
      <Icon name="gear" size={13} />
    </button>

    {#if dropdownOpen}
      <div
        class="ext-menu absolute right-0 top-full z-50 mt-1 min-w-32.5 text-xs"
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
              onDropdown();
              onOpen();
            }}
          >
            <Icon name="gear" size={12} class="opacity-60" />
            <span>Details</span>
          </button>
          <div class="mx-2 my-1 h-px bg-slate-100"></div>
        {/if}
        <button
          type="button"
          class="ext-menu-item {enabled ? 'text-ext-danger' : 'text-ext-success'}"
          onclick={() => {
            onDropdown();
            onToggle(!enabled);
          }}
        >
          <span>{enabled ? "Disable" : "Enable"}</span>
        </button>
      </div>
    {/if}
  </div>

  {#if feature.popup}
    <svg
      class="h-3.5 w-3.5 shrink-0 text-ext-muted transition-all group-hover:translate-x-0.5 group-hover:text-blue-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  {/if}
</div>
