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

<div class="flex items-center gap-2 {cls}">
  <input
    type="text"
    {id}
    class="ext-field h-9 min-w-0 flex-1 rounded-lg px-3 text-body font-mono font-semibold"
    {value}
    {placeholder}
    readonly={readonly}
  />
  <button
    type="button"
    id={buttonId}
    class="ext-icon-btn h-9 w-9 shrink-0"
    title={buttonTitle}
    aria-label={buttonTitle}
    onclick={oncopy}><Icon name="copy" size={13} /></button
  >
</div>
