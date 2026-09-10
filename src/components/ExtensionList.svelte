<script lang="ts">
  import type { FeatureModule } from "@/lib/feature-registry";
  import ExtensionRow from "./ExtensionRow.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    features: FeatureModule[];
    enabledMap: Record<string, boolean>;
    /** Accent color per feature id. */
    colorFor: (id: string) => string;
    onOpenDetail: (id: string) => void;
    onToggleFeature: (feature: FeatureModule, enabled: boolean) => void;
  }
  let {
    features,
    enabledMap,
    colorFor,
    onOpenDetail,
    onToggleFeature,
  }: Props = $props();

  let query = $state("");
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

  function focusSearch(): void {
    searchInput?.focus();
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
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
          onclick={() => (query = "")}
          >&times;</button
        >
      {/if}
    </div>
  </div>

  <!-- Category Header Bar -->
  <div class="flex h-6.5 shrink-0 items-center justify-between px-3">
    <span class="text-[10.5px] font-bold uppercase tracking-widest text-ext-muted">
      Extensions
    </span>
    <span
      class="rounded-sm border border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-px text-[9.5px] font-bold tabular-nums text-ext-text-secondary"
      >{filtered.length}</span
    >
  </div>

  <!-- Extension List -->
  <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
    {#if filtered.length === 0}
      <div class="flex flex-col items-center gap-2 px-3 py-10 text-center">
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
        <ExtensionRow
          {feature}
          {enabled}
          color={colorFor(feature.id)}
          dropdownOpen={activeDropdownId === feature.id}
          onOpen={() => {
            activeDropdownId = null;
            onOpenDetail(feature.id);
          }}
          onToggle={(v) => onToggleFeature(feature, v)}
          onDropdown={() =>
            (activeDropdownId =
              activeDropdownId === feature.id ? null : feature.id)}
        />
      {/each}
    {/if}
  </div>
</div>