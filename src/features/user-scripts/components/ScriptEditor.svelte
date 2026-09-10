<script lang="ts">
  import Button from "@/components/Button.svelte";
  import type { UserScriptRecord } from "../types/user-scripts.types";

  interface Props {
    script: UserScriptRecord;
    code: string;
    dirty: boolean;
    onInput: () => void;
    onSave: () => void;
    onClose: () => void;
  }
  let { script, code = $bindable(), dirty, onInput, onSave, onClose }: Props = $props();
</script>

<textarea
  class="h-56 w-full resize-y rounded-md border border-ext-border bg-ext-bg p-2 font-mono text-[11px] leading-relaxed outline-none focus:ring-1 focus:ring-ext-accent"
  spellcheck="false"
  bind:value={code}
  oninput={onInput}
></textarea>
<div class="mt-1.5 flex items-center justify-between">
  <span class="text-[10px] text-ext-muted">
    {dirty ? "Unsaved changes — auto-saves after 1s" : "All changes saved"}
  </span>
  <div class="flex gap-1.5">
    <Button size="sm" variant="ghost" onclick={onClose}>Close</Button>
    <Button size="sm" onclick={onSave} disabled={!dirty}>Save now</Button>
  </div>
</div>