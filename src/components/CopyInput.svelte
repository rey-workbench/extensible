<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    id?: string;
    buttonId?: string;
    value: string;
    placeholder?: string;
    readonly?: boolean;
    buttonTitle?: string;
    class?: string;
    oncopy?: () => void;
  }
  let {
    id = "extCopyInput",
    buttonId = "extCopyBtn",
    value,
    placeholder = "",
    readonly = true,
    buttonTitle = "Copy",
    class: cls = "",
    oncopy,
  }: Props = $props();
</script>

<div class="flex items-center gap-1.5 {cls}">
  <input
    type="text"
    {id}
    class="h-7.5 min-w-0 flex-1 rounded-md border-[1.5px] border-solid border-ext-border bg-ext-surface px-2.5 text-[12px] font-mono font-semibold text-ext-text outline-none transition-all focus:ring-2 focus:ring-ext-primary/25"
    {value}
    {placeholder}
    readonly={readonly}
  />
  <button
    type="button"
    id={buttonId}
    class="inline-flex h-7.5 w-7.5 shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-solid border-ext-border bg-ext-surface text-ext-text-secondary shadow-[2px_2px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
    title={buttonTitle}
    aria-label={buttonTitle}
    onclick={oncopy}><Icon name="copy" size={13} /></button>
</div>