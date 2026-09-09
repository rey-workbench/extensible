<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Icon from "@/components/Icon.svelte";

  type BadgeState = "idle" | "loading" | "filled" | "error";

  interface Props {
    /** The email input this badge floats beside. */
    target: HTMLInputElement;
    /** Generate (and fill) an email; resolves to the address or null on failure. */
    onFill: () => Promise<string | null>;
  }

  let { target, onFill }: Props = $props();

  let phase = $state<BadgeState>("idle");
  let rect = $state<DOMRect>(new DOMRect());

  const tooltip = $derived(
    phase === "loading" ? "Generating..." : phase === "filled" ? "Filled!" : phase === "error" ? "Error" : "Fill Temp Mail"
  );

  function updateRect(): void {
    if (!target.isConnected) return;
    rect = target.getBoundingClientRect();
  }

  function onViewportChange(): void {
    updateRect();
  }

  onMount(() => {
    updateRect();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("input", onViewportChange, true);
  });

  onDestroy(() => {
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("input", onViewportChange, true);
  });

  async function handleClick(e: MouseEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    if (phase === "loading") return;
    phase = "loading";
    try {
      const email = await onFill();
      if (email) {
        phase = "filled";
        // Brief green outline on the filled field
        target.style.outline = "2px solid #2D8C4E";
        target.style.boxShadow = "2px 2px 0 #1A1A1A";
        setTimeout(() => {
          target.style.outline = "";
          target.style.boxShadow = "";
        }, 1500);
      } else {
        phase = "idle";
      }
    } catch (err) {
      console.error("[TempMailBadge] autofill error:", err);
      phase = "error";
    }
    setTimeout(() => (phase = "idle"), 1500);
  }

  const hidden = $derived(!target.isConnected || rect.width === 0 || rect.height === 0);
  const top = $derived(rect.top + rect.height / 2);
  const left = $derived(rect.right - 36);
</script>

{#if !hidden}
  <button
    type="button"
    class="group flex items-center justify-center rounded-[4px] text-ext-danger transition-transform hover:scale-105 active:translate-x-px active:translate-y-px"
    class:aio-loading={phase === "loading"}
    style:top="{top}px"
    style:left="{left}px"
    style:width="24px"
    style:height="24px"
    style:position="fixed"
    style:z-index="2147483640"
    style:margin="0"
    style:padding="0"
    style:background="#FFFDF7"
    style:border="1.5px solid #1A1A1A"
    style:box-shadow="2px 2px 0 #1A1A1A"
    style:cursor="pointer"
    style:outline="none"
    style:user-select="none"
    style:box-sizing="border-box"
    style:transform="translateY(-50%)"
    style:display="flex"
    tabindex="-1"
    onmousedown={(e) => e.preventDefault()}
    onclick={handleClick}
    aria-label={tooltip}
  >
    {#if phase === "loading"}
      <Icon name="spinner" size={13} class="animate-spin text-ext-text" />
    {:else if phase === "filled"}
      <Icon name="check" size={13} class="text-ext-success" />
    {:else if phase === "error"}
      <Icon name="close" size={13} class="text-ext-danger" />
    {:else}
      <Icon name="mail" size={13} class="text-ext-danger" />
    {/if}
    <span
      class="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-[4px] border-[1.5px] border-ext-border bg-ext-surface px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-ext-text shadow-[2px_2px_0_#1A1A1A] opacity-0 transition-opacity group-hover:opacity-100"
      style:font-family="'Space Grotesk', system-ui, sans-serif"
    >{tooltip}</span>
  </button>
{/if}