<script lang="ts">
  
  import type { Snippet } from "svelte";
import Icon from "@/components/Icon.svelte";
  import type { IconName } from "@/lib/icons";

  interface Props {
    id?: string;
    title?: string;
    subtitle?: string;
    
    icon?: IconName;
    class?: string;
    headerAction?: Snippet;
    children: Snippet;
  }
  let {
    id,
    title,
    subtitle,
    icon,
    class: cls = "",
    headerAction,
    children,
  }: Props = $props();
</script>

<div id={id || undefined} class="ext-card overflow-hidden {cls}">
  {#if title || headerAction}
    <div class="flex items-center justify-between gap-2 border-b border-ext-border bg-ext-subtle/50 px-4 py-3">
      <div class="flex min-w-0 items-center gap-2.5">
        {#if icon}<Icon name={icon} size={15} class="shrink-0 text-ext-warning" />{/if}
        <div class="min-w-0">
          {#if title}<h3 class="truncate text-body font-bold uppercase tracking-wider text-ext-text">{title}</h3>{/if}
          {#if subtitle}<span class="text-label text-ext-muted">{subtitle}</span>{/if}
        </div>
      </div>
      {#if headerAction}<div class="shrink-0">{@render headerAction()}</div>{/if}
    </div>
  {/if}
  <div class="p-3.5 sm:p-4">{@render children()}</div>
</div>