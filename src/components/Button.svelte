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
    "inline-flex items-center justify-center gap-1.5 rounded-lg select-none transition-all duration-150 cursor-pointer font-semibold " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8] " +
    "disabled:pointer-events-none disabled:opacity-40";
  const variants: Record<Variant, string> = {
    primary:
      "bg-ext-primary text-white border border-transparent shadow-[0_4px_14px_rgba(26,115,232,0.35)] " +
      "hover:bg-ext-primary-dark hover:shadow-[0_6px_18px_rgba(26,115,232,0.45)] active:scale-[0.98]",
    secondary:
      "border border-slate-300 bg-slate-50 text-slate-800 shadow-[0_2px_6px_rgba(0,0,0,0.03)] " +
      "hover:bg-slate-100 hover:border-slate-400 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] active:scale-[0.98]",
    danger:
      "bg-red-500 text-white border border-transparent shadow-[0_4px_14px_rgba(239,68,68,0.3)] " +
      "hover:bg-red-600 active:scale-[0.98]",
    ghost: "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    outline: "border border-blue-400 bg-blue-50/70 text-[#1558b8] hover:bg-blue-100",
  };
  
  
  const sizes: Record<Size, string> = {
    sm: "h-8 px-3.5 py-1 text-body font-medium",
    md: "h-9 px-4 py-1.5 text-body font-semibold",
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