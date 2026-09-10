<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconName } from "@/lib/icons";
  import Icon from "./Icon.svelte";

  type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
  type Size = "sm" | "md";

  interface Props {
    variant?: Variant;
    size?: Size;
    icon?: IconName;
    iconPosition?: "left" | "right";
    disabled?: boolean;
    title?: string;
    id?: string;
    class?: string;
    type?: "button" | "submit" | "reset";
    ariaLabel?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = "secondary",
    size = "md",
    icon,
    iconPosition = "left",
    disabled = false,
    title,
    id,
    class: cls = "",
    type = "button",
    ariaLabel,
    onclick,
    children,
  }: Props = $props();

  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] border-solid select-none transition-all cursor-pointer font-semibold tracking-wide " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1B4DDB] " +
    "disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<Variant, string> = {
    primary:
      "bg-ext-primary text-white border-[1.5px] border-ext-primary-dark shadow-[2px_2px_0_#1A1A1A] " +
      "hover:bg-ext-primary-dark active:bg-[#0A2D7E] active:shadow-[1px_1px_0_#1A1A1A] active:translate-x-px active:translate-y-px",
    secondary:
      "border-[1.5px] border-ext-border bg-ext-surface text-ext-text shadow-[2px_2px_0_#1A1A1A] " +
      "hover:bg-[#EDE7DA] active:bg-[#E4DDD0] active:shadow-[1px_1px_0_#1A1A1A] active:translate-x-px active:translate-y-px",
    danger:
      "bg-ext-danger text-white border-[1.5px] border-[#A82624] shadow-[2px_2px_0_#1A1A1A] " +
      "hover:bg-[#B82A28] active:bg-[#9A2321] active:shadow-[1px_1px_0_#1A1A1A] active:translate-x-px active:translate-y-px",
    ghost: "border-[1.5px] border-transparent bg-transparent text-ext-text-secondary hover:bg-[#EDE7DA] hover:text-ext-text",
    outline: "border-[1.5px] border-ext-primary bg-transparent text-ext-primary hover:bg-ext-primary/10",
  };
  const sizes: Record<Size, string> = {
    sm: "h-6 px-2.5 py-0.5 text-[11px] uppercase",
    md: "h-7.5 px-3 py-1 text-xs uppercase",
  };

  const classes = $derived([base, variants[variant], sizes[size], cls].filter(Boolean).join(" "));
</script>

<button
  {type}
  class={classes}
  id={id || undefined}
  title={title || undefined}
  aria-label={ariaLabel || title || undefined}
  {disabled}
  onclick={onclick}
>
  {#if icon && iconPosition === "left"}
    <span class="flex shrink-0 items-center justify-center"><Icon name={icon} size={size === "sm" ? 12 : 14} /></span>
  {/if}
  {#if children}
    <span class="inline-block">{@render children()}</span>
  {/if}
  {#if icon && iconPosition === "right"}
    <span class="flex shrink-0 items-center justify-center"><Icon name={icon} size={size === "sm" ? 12 : 14} /></span>
  {/if}
</button>