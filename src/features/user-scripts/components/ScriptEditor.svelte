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
  let { script: _script, code = $bindable(), dirty, onInput, onSave, onClose }: Props = $props();
</script>

<div class="flex flex-col gap-1.5 rounded-md border border-ext-border bg-ext-bg p-2">
  <textarea
    class="h-56 w-full resize-y rounded-md border-[1.5px] border-ext-border bg-[#FFFDF7] p-2 font-mono text-[11px] leading-relaxed text-ext-text outline-none transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
    spellcheck="false"
    bind:value={code}
    oninput={onInput}
  ></textarea>
  <div class="flex flex-wrap items-center justify-between gap-1">
    <span class="text-[10px] text-ext-muted">
      {dirty ? "Unsaved changes (auto-saves 1s)" : "Saved"}
    </span>
    <div class="flex gap-1.5">
      <Button size="sm" variant="ghost" onclick={onClose}>Close</Button>
      <Button size="sm" variant="primary" onclick={onSave} disabled={!dirty}>Save now</Button>
    </div>
  </div>
</div>