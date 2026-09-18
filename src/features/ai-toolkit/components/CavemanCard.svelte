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
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex flex-col gap-0.5">
        <span class="text-body font-bold text-ext-text">Terse Response Mode</span>
        <span class="text-label text-ext-text-secondary"
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
        class="shrink-0 text-label font-bold uppercase tracking-wider text-ext-text-secondary"
        >Intensity:</span
      >
      <div class="flex gap-1.5">
        {#each CAVEMAN_LEVELS as lvl}
          <button
            type="button"
            class="cursor-pointer rounded-full px-3.5 py-1.5 text-label font-bold uppercase tracking-wider transition-all active:scale-95
                {caveman.level === lvl
              ? 'bg-ext-primary text-white shadow-sm'
              : 'border border-slate-300 bg-slate-50 text-ext-text-secondary hover:border-slate-400 hover:bg-slate-100'}"
            onclick={() => onSetLevel(lvl as CavemanLevel)}>{lvl}</button
          >
        {/each}
      </div>
    </div>
    <div class="text-label font-medium italic text-ext-muted">
      {cavemanHint}
    </div>
  </div>
</Card>