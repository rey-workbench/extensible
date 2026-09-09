<script lang="ts">
  import { type IconName, iconPath } from "@/lib/icons";

  interface Props {
    name: IconName;
    size?: number;
    class?: string;
    id?: string;
    style?: string;
  }

  let {
    name,
    size = 16,
    class: cls = "",
    id = "",
    style = "",
  }: Props = $props();
</script>

{#if name === "spinner"}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    class={cls}
    id={id || undefined}
    style={style || undefined}
    role="img"
    aria-hidden="true"
    ><circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="3"
      stroke-dasharray="31.4 31.4"
      stroke-linecap="round"
    /></svg
  >
{:else}
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    class={cls}
    id={id || undefined}
    style={style || undefined}
    role="img"
    aria-hidden="true"><path d={iconPath(name)} /></svg
  >
{/if}
