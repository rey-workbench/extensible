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
  class="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ext-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {checked
    ? 'bg-ext-success'
    : 'bg-ext-border-strong'}"
  onclick={() => onchange?.(!checked)}
>
  <span
    class="absolute top-0.5 h-4 w-4 rounded-full bg-ext-surface shadow-[0_1px_3px_rgba(15,23,42,0.25)] transition-all duration-200 {checked
      ? 'left-4.5'
      : 'left-0.5'}"
  ></span>
</button>
