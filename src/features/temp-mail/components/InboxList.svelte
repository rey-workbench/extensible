<script lang="ts">
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import { formatRelativeTime } from "@/lib/browser";
  import type { EmailMessage } from "../types/temp-mail.types";

  interface Props {
    emails: EmailMessage[];
    
    notice: string | null;
    isRefreshing: boolean;
    onRefresh: () => void;
    onOpen: (item: EmailMessage) => void;
  }
  let { emails, notice, isRefreshing, onRefresh, onOpen }: Props = $props();
</script>

<div class="flex h-7 shrink-0 items-center justify-between px-1">
  <div class="flex items-center gap-1.5 text-label font-bold uppercase tracking-widest text-ext-muted">
    <span>Inbox</span>
    <span
      class="rounded-full border border-ext-border bg-ext-subtle-strong px-2.5 py-0.5 text-label font-bold text-ext-text-secondary"
      >{emails.length}</span
    >
  </div>
  <button
    type="button"
    class="ext-icon-btn h-7 w-7"
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

{#if notice}
  <div
    class="flex items-start gap-2 rounded-xl border border-ext-warning-soft-border bg-ext-warning-soft px-3.5 py-2.5 text-label font-medium leading-snug text-ext-warning-ink"
    role="status"
  >
    <span class="font-bold" aria-hidden="true">!</span>
    <span>{notice}</span>
  </div>
{/if}

<div class="flex flex-col space-y-1">
  {#if emails.length === 0}
    <EmptyState title="Inbox is currently empty" />
  {:else}
    {#each emails as item (item.id)}
      <div
        class="ext-card flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-3 transition-all hover:scale-[1.01] hover:shadow-md {item.is_read
          ? 'border-l-[3px] border-l-transparent'
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
            class="truncate text-body {item.is_read
              ? 'text-ext-text-secondary'
              : 'font-bold text-ext-text'}"
          >
            {item.from_address || "Unknown"}
          </div>
          <div class="truncate text-label text-ext-muted">
            {item.subject || "(No Subject)"}
          </div>
        </div>
        <span class="shrink-0 text-label font-medium text-ext-muted"
          >{formatRelativeTime(item.received_at)}</span
        >
      </div>
    {/each}
  {/if}
</div>