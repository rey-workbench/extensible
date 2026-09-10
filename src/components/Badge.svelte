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
    primary: "bg-[#1B4DDB] text-white border-[#0F3BA8]",
    success: "bg-ext-success text-white border-[#1E6B38]",
    danger: "bg-ext-danger text-white border-[#A82624]",
    warning: "bg-ext-warning text-ext-text border-[#C48C1E]",
    neutral: "bg-[#EDE7DA] text-ext-text-secondary border-[#D4CEC2]",
  };
</script>

<span
  id={id || undefined}
  class="inline-flex items-center rounded-sm border border-solid px-2 py-px text-[10px] font-bold uppercase tracking-wider leading-4 {variants[variant]} {cls}"
>{text}</span>