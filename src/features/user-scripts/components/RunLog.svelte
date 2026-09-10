<script lang="ts">
  import type { UserScriptRunLogEntry } from "../types/user-scripts.types";

  interface Props {
    runLogs: UserScriptRunLogEntry[];
    lastRunAt: number | null;
  }
  let { runLogs, lastRunAt }: Props = $props();

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div class="mb-1 flex items-center justify-between">
  <span class="text-[10px] font-bold tracking-wider text-ext-muted uppercase">
    Run log ({runLogs.length})
  </span>
  <span class="text-[10px] text-ext-muted">
    Last run: {lastRunAt ? fmtTime(lastRunAt) : "never"}
  </span>
</div>
{#if runLogs.length === 0}
  <div class="py-1 text-[11px] text-ext-muted">No runs recorded yet.</div>
{:else}
  <ul class="flex flex-col gap-0.5">
    {#each runLogs as log}
      <li class="flex items-center gap-1.5 text-[11px]">
        <span class={log.ok ? "text-emerald-600" : "text-red-600"}>
          {log.ok ? "✓" : "✗"}
        </span>
        <span class="truncate text-ext-muted">{log.url}</span>
        <span class="ml-auto shrink-0 text-ext-muted">{fmtTime(log.ts)}</span>
        {#if log.message}
          <span class="truncate text-red-600" title={log.message}>{log.message}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}