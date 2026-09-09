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
    "inline-flex items-center justify-center gap-1.5 rounded select-none transition-colors cursor-pointer " +
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 " +
    "disabled:pointer-events-none disabled:opacity-55";
  const variants: Record<Variant, string> = {
    primary:
      "border-ext-primary-border bg-linear-to-b from-ext-primary-light to-ext-primary-mid text-white shadow-sm " +
      "hover:from-ext-primary-hover hover:to-ext-primary-hover-dark",
    secondary:
      "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-100 hover:border-slate-400",
    danger: "border border-red-300 bg-red-100 text-red-800 hover:bg-red-200 hover:text-red-900",
    ghost: "border border-transparent bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800",    outline: "border-ext-primary bg-transparent text-ext-primary hover:bg-blue-50",
  };
  const sizes: Record<Size, string> = {
    sm: "h-5.5 px-2 py-0.5 text-[11px]",
    md: "h-7 px-3 py-1.5 text-xs",
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