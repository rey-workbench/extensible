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
        variant="ghost"
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
      <div
        class="flex items-center gap-2 rounded-lg border-[1.5px] border-solid border-ext-border bg-ext-surface px-2 py-1.5 shadow-[2px_2px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA]"
      >
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-solid border-[#D4CEC2] bg-[#EDE7DA] text-ext-text-secondary"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"
            ><path
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
            /></svg
          >
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-bold text-ext-text">
            {item.title}
          </div>
          <div class="truncate text-[11px] font-medium text-ext-muted">
            {platformName} • {item.format.toUpperCase()} • {dateStr}
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          {#if item.content}
            <button
              type="button"
              class="inline-flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-solid border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
              title="Re-download"
              aria-label="Re-download"
              onclick={() => onDownload(item.id)}
              ><Icon name="download" size={14} /></button
            >
            <button
              type="button"
              class="inline-flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-solid border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
              title="Copy Content"
              aria-label="Copy Content"
              onclick={() => onCopy(item.id)}
              ><Icon name="copy" size={14} /></button
            >
          {/if}
          <button
            type="button"
            class="inline-flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-solid border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-ext-danger hover:border-[#A82624] hover:text-white active:translate-x-px active:translate-y-px"
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