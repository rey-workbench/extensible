<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Icon from "@/components/Icon.svelte";
  import { DANGER, INK, SUCCESS, SURFACE } from "@/lib/design-tokens";

  type BadgeState = "idle" | "loading" | "filled" | "error";

  interface Props {
    target: HTMLInputElement;
    onFill: () => Promise<string | null>;
  }

  let { target, onFill }: Props = $props();

  let phase = $state<BadgeState>("idle");
  let rect = $state<DOMRect>(new DOMRect());
  let isHovered = $state(false);

  const tooltip = $derived(
    phase === "loading"
      ? "Generating..."
      : phase === "filled"
        ? "Filled!"
        : phase === "error"
          ? "Error"
          : "Fill Temp Mail"
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
        
        target.style.outline = `2px solid ${SUCCESS}`;
        target.style.boxShadow = `2px 2px 0 ${INK}`;
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
    style:top="{top}px"
    style:left="{left}px"
    style:width="26px"
    style:height="26px"
    style:position="fixed"
    style:z-index="2147483640"
    style:margin="0"
    style:padding="0"
    style:background={phase === "error" ? DANGER : SURFACE}
    style:border={`1.5px solid ${INK}`}
    style:border-radius="8px"
    style:box-shadow={`2px 2px 0 ${INK}`}
    style:cursor="pointer"
    style:outline="none"
    style:user-select="none"
    style:box-sizing="border-box"
    style:transform="translateY(-50%) scale({isHovered ? 1.12 : 1})"
    style:display="flex"
    style:align-items="center"
    style:justify-content="center"
    style:transition="transform 0.15s ease, background 0.15s ease"
    style:color={INK}
    tabindex="-1"
    aria-label={tooltip}
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
    onmousedown={(e) => e.preventDefault()}
    onclick={handleClick}
  >
    {#if phase === "loading"}
      <span style:display="flex" style:animation="aio-badge-spin 0.9s linear infinite">
        <Icon name="spinner" size={13} />
      </span>
    {:else if phase === "filled"}
      <Icon name="check" size={13} style={`color:${SUCCESS}`} />
    {:else if phase === "error"}
      <Icon name="close" size={13} style={`color:${SURFACE}`} />
    {:else}
      <Icon name="mail" size={13} />
    {/if}

    <span
      style:position="fixed"
      style:top="{rect.top - 8}px"
      style:left="{rect.right - 26}px"
      style:transform="translateY(-100%)"
      style:z-index="2147483641"
      style:padding="4px 8px"
      style:background={INK}
      style:color={SURFACE}
      style:font="700 10px/1 'Segoe UI', system-ui, sans-serif"
      style:border-radius="4px"
      style:box-shadow="2px 2px 0 rgba(26,26,26,0.25)"
      style:white-space="nowrap"
      style:pointer-events="none"
      style:opacity={isHovered ? 1 : 0}
      style:transition="opacity 0.15s ease"
    >
      {tooltip}
    </span>
  </button>
{/if}
