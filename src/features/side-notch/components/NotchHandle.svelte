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
  class="group/handle relative flex h-full w-full cursor-pointer flex-col items-center justify-between overflow-hidden border-0 bg-ext-surface p-0 outline-none select-none"
  onclick={onOpen}
  aria-label="Open Extensible panel"
  title="Open Extensible (Click for drawer, hover for quick panel)"
>
  <div class="flex flex-col items-center pt-2">
    <span
      class="h-2.5 w-2.5 rounded-full border-[1.5px] border-ext-border transition-colors duration-200 {masterOn
        ? 'bg-ext-success'
        : 'bg-ext-muted'}"
      title={masterOn ? "All active" : "Disabled"}
    ></span>
  </div>

  <div class="flex flex-col items-center gap-1.5 py-1">
    <div class="flex flex-col items-center gap-0.75 opacity-60">
      <span class="h-[1.5px] w-3 rounded-full bg-ext-border"></span>
      <span class="h-[1.5px] w-3 rounded-full bg-ext-border"></span>
    </div>

    <span
      class="text-[9px] font-black uppercase tracking-[0.25em] text-ext-text [writing-mode:vertical-rl] rotate-180"
    >
      EXT
    </span>

    <div class="flex flex-col items-center gap-0.75 opacity-60">
      <span class="h-[1.5px] w-3 rounded-full bg-ext-border"></span>
    </div>
  </div>

  <div
    class="flex h-8 w-full items-center justify-center border-t-2 border-ext-border bg-ext-surface p-1 transition-colors group-hover/handle:bg-[#EDE7DA]"
  >
    <img
      src={logo32}
      alt="Extensible Logo"
      class="h-5 w-5 object-contain"
    />
  </div>
</button>