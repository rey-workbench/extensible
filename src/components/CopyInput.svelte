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

<div class="flex items-center gap-1 {cls}">
  <input
    type="text"
    {id}
    class="h-8 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
    {value}
    {placeholder}
    readonly={readonly}
  />
  <button
    type="button"
    id={buttonId}
    class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
    title={buttonTitle}
    aria-label={buttonTitle}
    onclick={oncopy}><Icon name="copy" size={14} /></button>
</div>