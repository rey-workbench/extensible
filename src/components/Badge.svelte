<script lang="ts">
  type Variant = "primary" | "success" | "danger" | "warning" | "neutral";

  interface Props {
    text: string;
    variant?: Variant;
    id?: string;
    class?: string;
  }
  let { text, variant = "neutral", id, class: cls = "" }: Props = $props();

  
  
  const variants: Record<Variant, string> = {
    primary: "bg-ext-info-soft text-ext-info-ink border-ext-info-soft-border",
    success: "bg-ext-success-soft text-ext-success-ink border-ext-success-soft-border",
    danger: "bg-ext-danger-soft text-ext-danger-ink border-ext-danger-soft-border",
    warning: "bg-ext-warning-soft text-ext-warning-ink border-ext-warning-soft-border",
    neutral: "bg-ext-subtle-strong text-ext-text-secondary border-ext-border",
  };
</script>

<span
  id={id || undefined}
  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-label font-bold tracking-wide leading-4 {variants[variant]} {cls}"
>{text}</span>
