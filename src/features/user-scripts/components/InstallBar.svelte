<script lang="ts">
  import Button from "@/components/Button.svelte";

  interface Props {
    installing: boolean;
    onInstall: (url: string) => void;
  }
  let { installing, onInstall }: Props = $props();

  let installUrl = $state("");
</script>

<div class="flex items-center gap-1.5 p-2">
  <input
    class="h-7 min-w-0 flex-1 rounded-md border border-ext-border bg-ext-bg px-2 text-[11px] outline-none placeholder:text-ext-muted focus:ring-1 focus:ring-ext-accent"
    placeholder="https://example.com/script.user.js"
    bind:value={installUrl}
    onkeydown={(e) => e.key === "Enter" && installUrl.trim() && onInstall(installUrl.trim())}
  />
  <Button size="sm" onclick={() => onInstall(installUrl.trim())} disabled={installing}>
    {installing ? "Installing…" : "Install"}
  </Button>
</div>