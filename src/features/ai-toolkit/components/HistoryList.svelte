<script lang="ts">
  import Badge from "@/components/Badge.svelte";
  import Button from "@/components/Button.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import SectionHeader from "@/components/SectionHeader.svelte";
  import { AI_PLATFORMS } from "../constants/ai-toolkit.constants";
  import type { ExportHistoryItem } from "../types/ai-toolkit.types";

  interface Props {
    history: ExportHistoryItem[];
    isLoading: boolean;
    onDownload: (id: string) => void;
    onCopy: (id: string) => void;
    onDelete: (id: string) => void;
    onClear: () => void;
  }
  let { history, isLoading, onDownload, onCopy, onDelete, onClear }: Props = $props();
</script>

<SectionHeader title="Export History">
  {#snippet badge()}
    {#if history.length > 0}<Badge text={String(history.length)} variant="neutral" />{/if}
  {/snippet}
  {#snippet action()}
    {#if history.length > 0}<Button
        size="sm"
        variant="secondary"
        disabled={isLoading}
        onclick={onClear}>Clear</Button
      >{/if}
  {/snippet}
</SectionHeader>

{#if history.length === 0}
  <EmptyState
    title="No exported chats yet"
    subtitle="Exported sessions will be recorded here."
  />
{:else}
  <div class="flex flex-col gap-1">
    {#each history as item (item.id)}
      {@const dateStr = new Date(item.exportedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
      {@const platformName = AI_PLATFORMS[item.platform]?.name || item.platform}
      <div              class="ext-card flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-all hover:scale-[1.01] hover:shadow-md"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-ext-primary"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"
            ><path
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
            /></svg
          >
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-body font-bold text-ext-text">
            {item.title}
          </div>
          <div class="truncate text-label font-medium text-ext-muted">
            {platformName} • {item.format.toUpperCase()} • {dateStr}
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          {#if item.hasContent}
            <button
              type="button"
              class="ext-icon-btn h-7 w-7"
              title="Re-download"
              aria-label="Re-download"
              onclick={() => onDownload(item.id)}
              ><Icon name="download" size={14} /></button
            >
            <button
              type="button"
              class="ext-icon-btn h-7 w-7"
              title="Copy Content"
              aria-label="Copy Content"
              onclick={() => onCopy(item.id)}
              ><Icon name="copy" size={14} /></button
            >
          {/if}
          <button
            type="button"
            class="ext-icon-btn ext-icon-btn-danger h-7 w-7"
            title="Delete"
            aria-label="Delete"
            onclick={() => onDelete(item.id)}
            ><Icon name="trash" size={14} /></button
          >
        </div>
      </div>
    {/each}
  </div>
{/if}