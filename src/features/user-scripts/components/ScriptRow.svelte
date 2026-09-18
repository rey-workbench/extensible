<script lang="ts">
  import type { Snippet } from "svelte";
  import Badge from "@/components/Badge.svelte";
  import Button from "@/components/Button.svelte";
  import Icon from "@/components/Icon.svelte";
  import Toggle from "@/components/Toggle.svelte";
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

<div class="flex flex-col gap-3.5 p-4">
  <div class="flex items-start gap-3">
    <div class="flex flex-col overflow-hidden rounded-lg border border-slate-200/70 bg-slate-50/70">
      <button
        type="button"
        class="flex h-6 w-7 cursor-pointer items-center justify-center text-ext-muted transition-colors hover:bg-white hover:text-ext-text disabled:cursor-not-allowed disabled:opacity-30"
        disabled={index === 0}
        onclick={() => onMove(-1)}
        title="Move up (higher priority)"
        aria-label="Move up"
      >
        <svg
          class="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        class="flex h-6 w-7 cursor-pointer items-center justify-center border-t border-slate-200/70 text-ext-muted transition-colors hover:bg-white hover:text-ext-text disabled:cursor-not-allowed disabled:opacity-30"
        disabled={index === total - 1}
        onclick={() => onMove(1)}
        title="Move down (lower priority)"
        aria-label="Move down"
      >
        <svg
          class="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="truncate text-body font-bold text-ext-text" title={script.meta.name}>
          {script.meta.name}
        </span>
        <Badge text={`v${script.meta.version}`} variant="neutral" />
      </div>
      <div
        class="mt-1 truncate text-xs text-ext-muted"
        title={script.meta.matches.join(", ")}
      >
        {script.meta.matches.join(", ")}
      </div>
    </div>

    <Toggle
      checked={script.enabled}
      label={`Toggle ${script.meta.name}`}
      onchange={onToggle}
    />
  </div>

  <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
    <div class="flex items-center gap-1.5">
      <Button
        variant={editing ? "primary" : "secondary"}
        size="sm"
        icon="markdown"
        onclick={onEdit}
        title="Edit script code"
      >
        Edit
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon="refresh"
        onclick={onRun}
        title="Run script in active tab"
      >
        Run
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon="star"
        onclick={onToggleLogs}
        title="Toggle execution log"
      >
        Log
      </Button>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="ext-icon-btn h-7 w-7"
        onclick={onDuplicate}
        title="Duplicate script"
      >
        <Icon name="copy" size={13} />
      </button>
      <button
        type="button"
        class="ext-icon-btn h-7 w-7"
        onclick={onExport}
        title="Export as .user.js"
      >
        <Icon name="download" size={13} />
      </button>
      <button
        type="button"
        class="ext-icon-btn ext-icon-btn-danger h-7 w-7"
        onclick={onDelete}
        title="Delete script"
      >
        <Icon name="trash" size={13} />
      </button>
    </div>
  </div>
</div>


{#if logOpen}
  <div class="border-t border-ext-border px-4 py-3">
    <RunLog {runLogs} lastRunAt={script.lastRunAt} />
  </div>
{/if}

{#if editing && editor}
  <div class="border-t border-ext-border p-3">
    {@render editor()}
  </div>
{/if}