<script lang="ts">
  interface Props {
    checked: boolean;
    onchange?: (checked: boolean) => void;
    label?: string;
    "aria-label"?: string;
    disabled?: boolean;
  }

  let {
    checked,
    onchange,
    label,
    "aria-label": ariaLabel,
    disabled = false,
  }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel ?? label}
  title={label}
  {disabled}
  class="relative h-4.5 w-8 shrink-0 cursor-pointer rounded-sm border-[1.5px] border-solid transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ext-primary/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 {checked
    ? 'bg-ext-success border-[#1E6B38]'
    : 'bg-[#D4CEC2] border-ext-muted'}"
  onclick={() => onchange?.(!checked)}
>
  <span
    class="absolute top-[1.5px] h-3.25 w-3.25 rounded-[3px] border border-solid border-ext-border/30 bg-white shadow-[1px_1px_0_rgba(26,26,26,0.2)] transition-all duration-200 {checked
      ? 'left-3.75'
      : 'left-0.5'}"
  ></span>
</button>
