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
        target.style.outline = "2px solid #10b981";
        target.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.2)";
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
    class="group flex items-center justify-center rounded text-white shadow-md opacity-85 transition-[opacity,background-color,box-shadow] hover:opacity-100"
    class:aio-loading={phase === "loading"}
    style:top="{top}px"
    style:left="{left}px"
    style:width="22px"
    style:height="22px"
    style:position="fixed"
    style:z-index="2147483640"
    style:margin="0"
    style:padding="0"
    style:background="linear-gradient(to bottom, #5b7ca6, #41638e)"
    style:border="1px solid #36567f"
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
      <Icon name="spinner" size={14} class="animate-spin" />
    {:else if phase === "filled"}
      <Icon name="check" size={14} />
    {:else if phase === "error"}
      <Icon name="close" size={14} />
    {:else}
      <Icon name="mail" size={14} />
    {/if}
    <span
      class="pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 shadow-md opacity-0 transition-all group-hover:opacity-100"
      style:font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    >{tooltip}</span>
  </button>
{/if}