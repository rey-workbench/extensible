<script lang="ts">
  import Icon from "@/components/Icon.svelte";
  import { formatRelativeTime } from "@/lib/browser";
  import type { EmailMessage } from "../types/temp-mail.types";

  interface Props {
    emails: EmailMessage[];
    isRefreshing: boolean;
    onRefresh: () => void;
    onOpen: (item: EmailMessage) => void;
  }
  let { emails, isRefreshing, onRefresh, onOpen }: Props = $props();
</script>

<div class="flex h-6 shrink-0 items-center justify-between px-1">
  <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ext-muted">
    <span>Inbox</span>
    <span
      class="rounded-sm border border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-0.2 text-[10px] font-bold text-ext-text-secondary"
      >{emails.length}</span
    >
  </div>
  <button
    type="button"
    class="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text disabled:opacity-50"
    title="Refresh Inbox"
    aria-label="Refresh Inbox"
    onclick={onRefresh}
    disabled={isRefreshing}
  >
    <Icon
      name="refresh"
      size={12}
      class={isRefreshing ? "animate-spin text-ext-primary" : ""}
    />
  </button>
</div>

<div class="flex flex-col space-y-1">
  {#if emails.length === 0}
    <div
      class="rounded-lg border-[1.5px] border-dashed border-ext-muted bg-ext-surface py-6 text-center text-xs font-medium text-ext-muted"
    >
      Inbox is currently empty
    </div>
  {:else}
    {#each emails as item (item.id)}
      <div
        class="ext-card flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition-all hover:bg-[#EDE7DA] {item.is_read
          ? 'opacity-70'
          : 'border-l-[3px] border-l-ext-primary'}"
        role="button"
        tabindex="0"
        onclick={() => onOpen(item)}
        onkeydown={(e) => e.key === "Enter" && onOpen(item)}
      >
        <span
          class="flex shrink-0 items-center justify-center {item.is_read
            ? 'text-ext-muted'
            : 'text-ext-primary'}"
        >
          <Icon name="mail" size={14} />
        </span>
        <div class="min-w-0 flex-1">
          <div
            class="truncate text-[12px] {item.is_read
              ? 'text-ext-text-secondary'
              : 'font-bold text-ext-text'}"
          >
            {item.from_address || "Unknown"}
          </div>
          <div class="truncate text-[11px] text-ext-muted">
            {item.subject || "(No Subject)"}
          </div>
        </div>
        <span class="shrink-0 text-[10px] font-medium text-ext-muted"
          >{formatRelativeTime(item.received_at)}</span
        >
      </div>
    {/each}
  {/if}
</div>