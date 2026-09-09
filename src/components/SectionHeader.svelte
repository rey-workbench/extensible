<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    id?: string;
    class?: string;
    badge?: Snippet;
    action?: Snippet;
  }
  let { title, id, class: cls = "", badge, action }: Props = $props();
</script>

<div id={id || undefined} class="mb-2 flex items-center justify-between {cls}">
  <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
    <span>{title}</span>
    {#if badge}{@render badge()}{/if}
  </div>
  {#if action}<div class="flex items-center gap-1">{@render action()}</div>{/if}
</div>