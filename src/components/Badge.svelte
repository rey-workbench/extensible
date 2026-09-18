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
    primary: "bg-blue-50 text-[#1558b8] border-blue-200",
    success: "bg-emerald-50 text-[#047857] border-emerald-200",
    danger: "bg-red-50 text-[#b91c1c] border-red-200",
    warning: "bg-amber-50 text-[#b45309] border-amber-200",
    neutral: "bg-slate-100 text-ext-text-secondary border-slate-200",
  };
</script>

<span
  id={id || undefined}
  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-label font-bold tracking-wide leading-4 {variants[variant]} {cls}"
>{text}</span>
