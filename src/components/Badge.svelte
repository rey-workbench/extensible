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
    primary: "bg-blue-100 text-blue-700",
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-red-100 text-red-700",
    warning: "bg-amber-100 text-amber-700",
    neutral: "bg-slate-100 text-slate-600",
  };
</script>

<span
  id={id || undefined}
  class="inline-flex items-center rounded-full px-2 py-px text-[10px] font-semibold leading-4 {variants[variant]} {cls}"
>{text}</span>