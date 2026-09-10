<script lang="ts">
  

  import type { Snippet } from "svelte";
import Badge from "@/components/Badge.svelte";
  import Button from "@/components/Button.svelte";
  import Icon from "@/components/Icon.svelte";
  import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
  import RunLog from "./RunLog.svelte";

  interface Props {
    script: UserScriptRecord;
    index: number;
    total: number;
    runLogs: UserScriptRunLogEntry[];
    logOpen: boolean;
    editing: boolean;
    editor?: Snippet;
    onMove: (dir: -1 | 1) => void;
    onToggle: (enabled: boolean) => void;
    onEdit: () => void;
    onRun: () => void;
    onToggleLogs: () => void;
    onDuplicate: () => void;
    onExport: () => void;
    onDelete: () => void;
  }
  let {
    script,
    index,
    total,
    runLogs,
    logOpen,
    editing,
    editor,
    onMove,
    onToggle,
    onEdit,
    onRun,
    onToggleLogs,
    onDuplicate,
    onExport,
    onDelete,
  }: Props = $props();
</script>

<div class="flex items-center gap-2 p-2.5">
  <!-- Priority controls -->
  <div class="flex flex-col">
    <button
      class="text-ext-muted hover:text-ext-text disabled:opacity-30"
      disabled={index === 0}
      onclick={() => onMove(-1)}
      title="Move up (higher priority)"
    >▲</button>
    <button
      class="text-ext-muted hover:text-ext-text disabled:opacity-30"
      disabled={index === total - 1}
      onclick={() => onMove(1)}
      title="Move down (lower priority)"
    >▼</button>
  </div>

  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-1.5">
      <span class="truncate text-[12px] font-semibold">{script.meta.name}</span>
      <Badge text={script.enabled ? "ON" : "OFF"} variant={script.enabled ? "success" : "neutral"} />
      <Badge text={`v${script.meta.version}`} variant="neutral" />
    </div>
    <div class="truncate text-[10.5px] text-ext-muted">
      {script.meta.matches.join(", ")}
    </div>
  </div>

  <!-- Toggle -->
  <button
    role="switch"
    aria-checked={script.enabled}
    aria-label={`Toggle ${script.meta.name}`}
    onclick={() => onToggle(!script.enabled)}
    class="relative h-4.5 w-8 shrink-0 rounded-full transition-colors {script.enabled
      ? 'bg-ext-accent'
      : 'bg-ext-border'}"
  >
    <span
      class="absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform {script.enabled
        ? 'translate-x-3.5'
        : ''}"
    ></span>
  </button>

  <!-- Row actions -->
  <div class="flex items-center gap-0.5">
    <Button variant="ghost" size="sm" onclick={onEdit} title="Edit">
      <Icon name="markdown" size={14} />
    </Button>
    <Button variant="ghost" size="sm" onclick={onRun} title="Run in active tab">
      <Icon name="refresh" size={14} />
    </Button>
    <Button variant="ghost" size="sm" onclick={onToggleLogs} title="Run log">
      <Icon name="star" size={14} />
    </Button>
    <Button variant="ghost" size="sm" onclick={onDuplicate} title="Duplicate">
      <Icon name="copy" size={14} />
    </Button>
    <Button variant="ghost" size="sm" onclick={onExport} title="Export .user.js">
      <Icon name="download" size={14} />
    </Button>
    <Button variant="ghost" size="sm" onclick={onDelete} title="Delete">
      <Icon name="trash" size={14} />
    </Button>
  </div>
</div>

{#if logOpen}
  <div class="border-t border-ext-border px-2.5 py-2">
    <RunLog {runLogs} lastRunAt={script.lastRunAt} />
  </div>
{/if}

{#if editing && editor}
  <div class="border-t border-ext-border p-2">
    {@render editor()}
  </div>
{/if}