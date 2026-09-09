<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    id?: string;
    title?: string;
    subtitle?: string;
    class?: string;
    headerAction?: Snippet;
    children: Snippet;
  }
  let { id, title, subtitle, class: cls = "", headerAction, children }: Props = $props();
</script>

<div id={id || undefined} class="ext-card overflow-hidden rounded-lg {cls}">
  {#if title || headerAction}
    <div class="flex items-center justify-between gap-2 border-b border-ext-border bg-[#EDE7DA] px-3 py-2">
      <div class="min-w-0">
        {#if title}<h3 class="truncate text-[12.5px] font-bold uppercase tracking-wide text-ext-text">{title}</h3>{/if}
        {#if subtitle}<span class="text-[11px] text-ext-text-secondary">{subtitle}</span>{/if}
      </div>
      {#if headerAction}<div class="shrink-0">{@render headerAction()}</div>{/if}
    </div>
  {/if}
  <div class="p-3">{@render children()}</div>
</div>