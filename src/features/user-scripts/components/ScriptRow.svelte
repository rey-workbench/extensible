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

<div class="flex flex-col gap-2 p-2.5">
  <!-- Row 1: Priority + Name & Details + Toggle -->
  <div class="flex items-start gap-2">
    <!-- Priority controls -->
    <div class="flex flex-col pt-0.5">
      <button
        type="button"
        class="cursor-pointer text-[10px] leading-none text-ext-muted transition-colors hover:text-ext-text disabled:cursor-not-allowed disabled:opacity-25"
        disabled={index === 0}
        onclick={() => onMove(-1)}
        title="Move up (higher priority)"
      >▲</button>
      <button
        type="button"
        class="cursor-pointer text-[10px] leading-none text-ext-muted transition-colors hover:text-ext-text disabled:cursor-not-allowed disabled:opacity-25"
        disabled={index === total - 1}
        onclick={() => onMove(1)}
        title="Move down (lower priority)"
      >▼</button>
    </div>

    <!-- Title & domain matches -->
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="truncate text-xs font-bold text-ext-text" title={script.meta.name}>
          {script.meta.name}
        </span>
        <Badge text={`v${script.meta.version}`} variant="neutral" />
      </div>
      <div class="truncate text-[10.5px] text-ext-muted" title={script.meta.matches.join(", ")}>
        {script.meta.matches.join(", ")}
      </div>
    </div>

    <!-- Neo-Brutalist Toggle -->
    <Toggle
      checked={script.enabled}
      label={`Toggle ${script.meta.name}`}
      onchange={onToggle}
    />
  </div>

  <!-- Row 2: Action Toolbar (Responsive, doesn't crowd Title) -->
  <div class="flex flex-wrap items-center justify-between gap-1 border-t border-ext-border/30 pt-1.5">
    <!-- Main Actions: Edit, Run, Log -->
    <div class="flex items-center gap-1">
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
        variant={logOpen ? "secondary" : "ghost"}
        size="sm"
        icon="star"
        onclick={onToggleLogs}
        title="Toggle execution log"
      >
        Log
      </Button>
    </div>

    <!-- Secondary Actions: Duplicate, Export, Delete -->
    <div class="flex items-center gap-0.5">
      <button
        type="button"
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-transparent text-ext-muted transition-all hover:border-ext-border hover:bg-[#EDE7DA] hover:text-ext-text"
        onclick={onDuplicate}
        title="Duplicate script"
      >
        <Icon name="copy" size={13} />
      </button>
      <button
        type="button"
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-transparent text-ext-muted transition-all hover:border-ext-border hover:bg-[#EDE7DA] hover:text-ext-text"
        onclick={onExport}
        title="Export as .user.js"
      >
        <Icon name="download" size={13} />
      </button>
      <button
        type="button"
        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-transparent text-ext-danger transition-all hover:border-[#A82624]/30 hover:bg-ext-danger/10"
        onclick={onDelete}
        title="Delete script"
      >
        <Icon name="trash" size={13} />
      </button>
    </div>
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