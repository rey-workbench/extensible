<script lang="ts">
  import Button from "@/components/Button.svelte";

  interface Props {
    onCreate: (name: string) => void;
  }
  let { onCreate }: Props = $props();

  let name = $state("");
</script>

<div class="flex items-center gap-1.5 p-2">
  <input
    class="h-7 min-w-0 flex-1 rounded-md border border-ext-border bg-ext-bg px-2 text-[11px] outline-none placeholder:text-ext-muted focus:ring-1 focus:ring-ext-accent"
    placeholder="New script name…"
    bind:value={name}
    onkeydown={(e) => e.key === "Enter" && name.trim() && onCreate(name.trim())}
  />
  <Button size="sm" onclick={() => name.trim() && onCreate(name.trim())}>New script</Button>
</div>