<script lang="ts">
  import Badge from "@/components/Badge.svelte";
  import Card from "@/components/Card.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import { CAVEMAN_HINTS, CAVEMAN_LEVELS, type CavemanLevel } from "../constants/ai-toolkit.constants";
  import type { CavemanSettings } from "../types/ai-toolkit.types";

  interface Props {
    caveman: CavemanSettings;
    onToggle: (enabled: boolean) => void;
    onSetLevel: (level: CavemanLevel) => void;
  }
  let { caveman, onToggle, onSetLevel }: Props = $props();

  const cavemanHint = $derived(CAVEMAN_HINTS[caveman.level] || "");
</script>

<Card title="Caveman Mode">
  {#snippet headerAction()}<Badge
      text={caveman.enabled ? "ON" : "OFF"}
      variant={caveman.enabled ? "warning" : "neutral"}
    />{/snippet}
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <div class="flex flex-col">
        <span class="text-xs font-bold text-ext-text">Terse Response Mode</span>
        <span class="text-[11px] text-ext-text-secondary"
          >Strip fluff, pleasantries &amp; hedging. Retain 100% technical code
          &amp; substance.</span
        >
      </div>
      <Toggle
        checked={caveman.enabled}
        label={caveman.enabled ? "Disable Caveman mode" : "Enable Caveman mode"}
        onchange={(v) => onToggle(v)}
      />
    </div>
    <div class="flex items-center gap-2">
      <span
        class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-ext-text-secondary"
        >Intensity:</span
      >
      <div class="flex gap-1">
        {#each CAVEMAN_LEVELS as lvl}
          <button
            type="button"
            class="cursor-pointer rounded-sm border-[1.5px] border-solid px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all active:translate-x-px active:translate-y-px shadow-[1px_1px_0_#1A1A1A]
                {caveman.level === lvl
              ? 'border-ext-primary bg-ext-primary text-white'
              : 'border-ext-border bg-ext-surface text-ext-text-secondary hover:bg-[#EDE7DA]'}"
            onclick={() => onSetLevel(lvl as CavemanLevel)}>{lvl}</button
          >
        {/each}
      </div>
    </div>
    <div class="text-[11px] font-medium italic text-ext-muted">
      {cavemanHint}
    </div>
  </div>
</Card>