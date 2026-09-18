<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    subtitle?: string;
    id?: string;
    class?: string;
    icon?: Snippet;
    action?: Snippet;
    
    boxed?: boolean;
  }
  let {
    title,
    subtitle,
    id,
    class: cls = "",
    icon,
    action,
    boxed = true,
  }: Props = $props();
</script>

<div
  id={id || undefined}
  class="flex flex-col items-center justify-center gap-1.5 text-center {boxed
    ? 'rounded-2xl border-2 border-dashed border-ext-border bg-ext-surface/60 px-4 py-7'
    : 'py-6'} {cls}"
>
  {#if icon}<div class="mb-1 text-ext-muted">{@render icon()}</div>{/if}
  <div class="text-sm font-bold text-ext-text">{title}</div>
  {#if subtitle}<div class="max-w-sm text-body text-ext-text-secondary">{subtitle}</div>{/if}
  {#if action}<div class="mt-2">{@render action()}</div>{/if}
</div>
