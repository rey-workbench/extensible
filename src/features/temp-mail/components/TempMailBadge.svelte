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
  let isHovered = $state(false);

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
    style:transform={isHovered ? "translateY(-50%) scale(1.05)" : "translateY(-50%)"}
    style:display="flex"
    style:align-items="center"
    style:justify-content="center"
    style:border-radius="2px"
    style:transition="transform 0.15s"
    style:color="#D63230"
    tabindex="-1"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
    onmousedown={(e) => e.preventDefault()}
    onclick={handleClick}
    aria-label={tooltip}
  >
    {#if phase === "loading"}
      <Icon name="spinner" size={13} style="color: #1A1A1A; animation: aio-spin 1s linear infinite;" />
    {:else if phase === "filled"}
      <Icon name="check" size={13} style="color: #2D8C4E;" />
    {:else if phase === "error"}
      <Icon name="close" size={13} style="color: #D63230;" />
    {:else}
      <Icon name="mail" size={13} style="color: #D63230;" />
    {/if}
    <span
      style:pointer-events="none"
      style:position="absolute"
      style:bottom="100%"
      style:right="0"
      style:margin-bottom="6px"
      style:white-space="nowrap"
      style:border-radius="2px"
      style:border="1.5px solid #2B2B2B"
      style:background="#FFFDF7"
      style:padding="2px 8px"
      style:font-size="9.5px"
      style:font-weight="900"
      style:text-transform="uppercase"
      style:letter-spacing="0.05em"
      style:color="#1A1A1A"
      style:box-shadow="2px 2px 0 #1A1A1A"
      style:font-family="'Space Grotesk', system-ui, sans-serif"
      style:opacity={isHovered ? 1 : 0}
      style:transition="opacity 0.15s"
    >{tooltip}</span>
  </button>
{/if}

<style>
  @keyframes aio-spin {
    to { transform: rotate(360deg); }
  }
</style>