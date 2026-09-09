<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    subtitle?: string;
    id?: string;
    class?: string;
    icon?: Snippet;
    action?: Snippet;
  }
  let { title, subtitle, id, class: cls = "", icon, action }: Props = $props();
</script>

<div id={id || undefined} class="flex flex-col items-center justify-center gap-1 py-6 text-center {cls}">
  {#if icon}<div class="mb-1 text-ext-muted">{@render icon()}</div>{/if}
  <div class="text-sm font-bold text-ext-text">{title}</div>
  {#if subtitle}<div class="text-xs text-ext-text-secondary">{subtitle}</div>{/if}
  {#if action}<div class="mt-2">{@render action()}</div>{/if}
</div>