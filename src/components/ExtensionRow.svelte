<script lang="ts">
  import type { FeatureModule } from "@/lib/feature-registry";
  import Icon from "./Icon.svelte";

  interface Props {
    feature: FeatureModule;
    enabled: boolean;
    /** Accent color for the app icon chip. */
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
  class="group flex cursor-pointer items-center gap-2.5 rounded-lg border-[1.5px] border-solid border-ext-border bg-ext-surface px-2 py-1.5 shadow-[2px_2px_0_#1A1A1A] transition-all {enabled
    ? 'hover:bg-[#EDE7DA] hover:shadow-[3px_3px_0_#1A1A1A] active:shadow-[1px_1px_0_#1A1A1A] active:translate-x-px active:translate-y-px'
    : 'opacity-55 hover:opacity-75'} {dropdownOpen
    ? 'relative z-20 bg-[#EDE7DA] shadow-[3px_3px_0_#1A1A1A]'
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
  <!-- App Icon -->
  <span
    class="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-solid text-white shadow-[1px_1px_0_#1A1A1A] transition-transform group-hover:scale-105"
    style="background: {color}; border-color: {color}; {enabled ? '' : 'filter: grayscale(100%); opacity: 0.55;'}"
  >
    <Icon name={feature.icon} size={14} />
  </span>

  <!-- Extension Info -->
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-1.5">
      <span class="truncate text-[12.5px] font-bold text-ext-text">
        {feature.name}
      </span>
      {#if !enabled}
        <span
          class="shrink-0 rounded-[3px] border border-solid border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-ext-muted"
        >Off</span>
      {/if}
    </div>
    <div class="truncate text-[10.5px] text-ext-text-secondary"
      >{feature.description}</div
    >
  </div>

  <!-- Settings Gear Button & Options Dropdown -->
  <div class="relative">
    <button
      type="button"
      class="flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-solid border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
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
              onDropdown();
              onOpen();
            }}
          >
            <Icon name="gear" size={12} class="opacity-60" />
            <span>Details</span>
          </button>
          <div class="mx-2 my-1 h-px bg-ext-border/20"></div>
        {/if}
        <button
          type="button"
          class="ext-menu-item {enabled ? 'text-ext-danger' : 'text-ext-success'}"
          onclick={() => {
            onDropdown();
            onToggle(!enabled);
          }}
        >
          <span
            class="h-1.5 w-1.5 rounded-full {enabled ? 'bg-ext-danger' : 'bg-ext-success'}"
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