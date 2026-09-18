<script lang="ts">
  interface Props {
    logo32: string;
    masterOn: boolean;
    onOpen: () => void;
  }
  let { logo32, masterOn, onOpen }: Props = $props();
</script>

<button
  type="button"
  class="group/handle relative flex h-full w-full cursor-pointer flex-col items-center justify-between overflow-hidden border-0 p-0 outline-none select-none backdrop-blur-md transition-all {masterOn
    ? 'bg-ext-surface/90 hover:bg-ext-surface'
    : 'bg-ext-subtle-strong/90 hover:bg-ext-subtle'}"
  onclick={onOpen}
  aria-label="Open Extensible floating launcher"
  title={masterOn
    ? "Open Extensible Hub (all modules active)"
    : "Open Extensible Hub (all modules disabled)"}
>
  <div class="pt-2.5"></div>

  <div class="flex flex-col items-center gap-2 py-1">
    <div class="flex flex-col items-center gap-1 opacity-40 group-hover/handle:opacity-80 transition-opacity">
      <span class="h-1 w-3 rounded-full bg-ext-border-strong"></span>
      <span class="h-1 w-3 rounded-full bg-ext-border-strong"></span>
    </div>

    <span
      class="text-chip font-black uppercase tracking-[0.25em] text-ext-muted [writing-mode:vertical-rl] rotate-180 transition-colors group-hover/handle:text-blue-600"
    >
      EXT
    </span>

    <div class="flex flex-col items-center gap-1 opacity-40 group-hover/handle:opacity-80 transition-opacity">
      <span class="h-1 w-3 rounded-full bg-ext-border-strong"></span>
    </div>
  </div>

  <div
    class="flex h-9 w-full items-center justify-center rounded-b-2xl border-t border-ext-border bg-ext-subtle/80 p-1.5 transition-colors group-hover/handle:bg-blue-50/80"
  >
    <img
      src={logo32}
      alt="Extensible Logo"
      class="h-5 w-5 object-contain transition-all duration-200 group-hover/handle:scale-110 {masterOn
        ? ''
        : 'opacity-45 grayscale'}"
    />
  </div>
</button>