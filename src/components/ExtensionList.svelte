<script lang="ts">
  
  import { isEnabledIn } from "@/lib/feature-flags";
import { type FeatureModule, getFeatureColor } from "@/lib/feature-registry";
  import EmptyState from "./EmptyState.svelte";
  import ExtensionRow from "./ExtensionRow.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    features: FeatureModule[];
    enabledMap: Record<string, boolean>;
    onOpenDetail: (id: string) => void;
    onToggleFeature: (feature: FeatureModule, enabled: boolean) => void;
  }
  let { features, enabledMap, onOpenDetail, onToggleFeature }: Props = $props();

  let query = $state("");
  let searchInput = $state<HTMLInputElement | null>(null);
  let activeDropdownId = $state<string | null>(null);

  const filtered = $derived(
    features.filter((f) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      );
    }),
  );

  function focusSearch(): void {
    searchInput?.focus();
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="px-3 pb-2 pt-3">
    <div
      class="flex h-9 items-center gap-2 rounded-lg border border-ext-border-strong bg-ext-subtle px-3.5 transition-all focus-within:border-ext-primary focus-within:bg-ext-surface focus-within:ring-2 focus-within:ring-ext-primary/10"
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
        class="h-full min-w-0 flex-1 border-0 bg-transparent text-xs font-medium text-ext-text outline-none placeholder:text-ext-muted"
        placeholder="Search apps & tools…"
        autocomplete="off"
        spellcheck="false"
        bind:value={query}
      />
      {#if query}
        <button
          type="button"
          class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-ext-muted transition-colors hover:bg-ext-subtle-strong hover:text-ext-text"
          aria-label="Clear search"
          onclick={() => (query = "")}
          >&times;</button
        >
      {/if}
    </div>
  </div>

  <div class="flex h-7 shrink-0 items-center justify-between px-4">
    <span class="text-label font-bold uppercase tracking-widest text-ext-muted">
      Extensions
    </span>
    <span
      class="ext-count-pill"
      >{filtered.length}</span
    >
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
    {#if filtered.length === 0}
      <EmptyState
        title={query ? "No matches" : "No extensions"}
        subtitle={query
          ? "Try a different search term"
          : "Nothing to show here yet"}
      >
        {#snippet icon()}
          <span
            class="flex h-10 w-10 items-center justify-center rounded-2xl border border-ext-border bg-ext-subtle text-ext-muted"
          >
            <Icon name="puzzle" size={18} />
          </span>
        {/snippet}
      </EmptyState>
    {:else}
      {#each filtered as feature (feature.id)}
        {@const enabled = isEnabledIn(enabledMap, feature.id)}
        <ExtensionRow
          {feature}
          {enabled}
          color={getFeatureColor(feature.id)}
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
