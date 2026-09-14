<script lang="ts">
  import { onMount } from "svelte";
  import Button from "@/components/Button.svelte";
  import type { UserScriptRecord } from "../types/user-scripts.types";

  interface Props {
    script: UserScriptRecord;
    code: string;
    dirty: boolean;
    onInput: () => void;
    onSave: () => void;
    onClose: () => void;
    onRun?: () => void;
  }
  let { script, code = $bindable(), dirty, onInput, onSave, onClose, onRun }: Props = $props();

  let editorEl = $state<HTMLDivElement | null>(null);
  let lineNumbersEl = $state<HTMLDivElement | null>(null);
  type CodeJarInstance = ReturnType<typeof import("codejar").CodeJar>;
  let jar = $state<CodeJarInstance | null>(null);

  const lines = $derived(code.split("\n"));
  const lineCount = $derived(lines.length);

  function syncScroll(): void {
    if (editorEl && lineNumbersEl) {
      lineNumbersEl.scrollTop = editorEl.scrollTop;
    }
  }

  function onGutterWheel(e: WheelEvent): void {
    if (editorEl) {
      editorEl.scrollTop += e.deltaY;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    // Ctrl+S / Cmd+S: Save immediately
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      onSave();
    }
  }

  onMount(() => {
    let cleanup: (() => void) | undefined;

    void (async () => {
      if (!editorEl) return;

      const [{ CodeJar }, { default: Prism }] = await Promise.all([
        import("codejar"),
        import("prismjs"),
      ]);

      const highlight = (el: HTMLElement): void => {
        const text = el.textContent || "";
        el.innerHTML = Prism.highlight(
          text,
          Prism.languages.javascript,
          "javascript",
        );
      };

      const instance = CodeJar(editorEl, highlight, {
        tab: "  ",
        catchTab: true,
        preserveIdent: true,
        addClosing: true,
        history: true,
      });

      editorEl.style.whiteSpace = "pre";
      editorEl.style.overflowWrap = "normal";

      instance.updateCode(code, false);

      instance.onUpdate((newCode) => {
        if (code !== newCode) {
          code = newCode;
          onInput();
        }
      });

      editorEl.addEventListener("scroll", syncScroll);
      jar = instance;

      cleanup = () => {
        if (editorEl) {
          editorEl.removeEventListener("scroll", syncScroll);
        }
        instance.destroy();
      };
    })();

    return () => {
      cleanup?.();
    };
  });

  // Keep CodeJar in sync when switching scripts
  $effect(() => {
    const _activeId = script.id;
    if (jar && jar.toString() !== code) {
      jar.updateCode(code, false);
    }
  });
</script>

<div class="flex flex-col h-full min-h-[540px] rounded-xl border-[1.5px] border-solid border-ext-border bg-[#16171B] text-gray-200 shadow-[2px_2px_0_#1A1A1A] overflow-hidden">
  <!-- Editor Header -->
  <div class="flex flex-wrap items-center justify-between border-b border-solid border-[#262830] bg-[#1E2026] px-3.5 py-2.5 gap-2">
    <div class="flex items-center gap-2.5 min-w-0">
      <!-- Official JavaScript Logo -->
      <svg class="h-4.5 w-4.5 rounded-[3px] shrink-0 shadow-xs" viewBox="0 0 630 630" xmlns="http://www.w3.org/2000/svg" aria-label="JavaScript">
        <rect width="630" height="630" fill="#F7DF1E"/>
        <path d="m423.2 492.19c12.69 20.72 29.18 35.79 58.4 35.79 24.53 0 40.17-12.26 40.17-29.2 0-20.3-16.07-27.91-43.12-39.76l-14.8-6.35c-42.72-18.18-71.05-41.02-71.05-89.22 0-44.4 33.83-78.07 86.68-78.07 37.64 0 64.7 13.11 83.31 45.67l-35.36 22.68c-7.61-13.53-17.76-20.72-35.1-20.72-16.07 0-26.64 10.15-26.64 22.83 0 16.07 10.15 22.83 33.41 32.98l14.8 6.34c50.32 21.57 78.91 43.56 78.91 93.45 0 53.28-41.87 83.31-98.1 83.31-54.98 0-90.5-26.22-106.99-63.43zm-196.24 3.81c9.73 17.76 21.14 31.29 44.82 31.29 20.72 0 33.83-10.15 33.83-33.83v-176.76h48.63v177.6c0 48.63-28.76 74.43-76.97 74.43-41.44 0-66.81-21.57-79.92-49.48z" fill="#000000"/>
      </svg>
      <h3 class="text-[13px] font-bold text-white truncate max-w-md">{script.meta.name}</h3>
      <span class="text-[10.5px] text-gray-400 font-mono">v{script.meta.version || "1.0"}</span>
    </div>

    <div class="flex items-center gap-2">
      {#if onRun}
        <Button size="sm" variant="secondary" onclick={onRun} class="h-7 text-[11px] bg-[#2A2D36] text-gray-200 hover:bg-[#343843] border-[#3A3E4B]">
          Run in Tab
        </Button>
      {/if}
      <Button size="sm" variant="ghost" onclick={onClose} class="h-7 text-[11px] text-gray-300 hover:bg-[#2A2D36]">
        Close
      </Button>
      <Button size="sm" variant="primary" onclick={onSave} disabled={!dirty} class="h-7 text-[11px]">
        {dirty ? "Save Now" : "Saved"}
      </Button>
    </div>
  </div>

  <!-- Code Editor Body (Gutter + CodeJar) -->
  <div class="relative flex flex-1 min-h-[440px] max-h-[calc(100vh-220px)] overflow-hidden bg-[#131417]">
    <!-- Line numbers gutter -->
    <div
      bind:this={lineNumbersEl}
      onwheel={onGutterWheel}
      class="editor-gutter w-12 shrink-0 select-none overflow-hidden bg-[#18191E] border-r border-solid border-[#262830] py-3 text-right text-[#565A68]"
      aria-hidden="true"
    >
      {#each lines as _, idx}
        <div class="pr-2.5">{idx + 1}</div>
      {/each}
    </div>

    <!-- CodeJar Editor Element -->
    <div
      bind:this={editorEl}
      onkeydown={handleKeydown}
      role="textbox"
      tabindex="0"
      aria-label="Code Editor"
      class="editor-code flex-1 overflow-auto p-3 pb-10 text-[#abb2bf] outline-none caret-amber-400 selection:bg-[#3E4451]"
      style="tab-size: 2;"
      spellcheck="false"
    ></div>
  </div>

  <!-- Status Bar Footer -->
  <div class="flex items-center justify-between border-t border-solid border-[#262830] bg-[#18191E] px-3.5 py-1.5 text-[10.5px] font-mono text-gray-400">
    <div class="flex items-center gap-3">
      <span>{lineCount} lines</span>
      <span>{code.length} chars</span>
      <span class="hidden sm:inline text-gray-500">Tab: 2 spaces · Enter: auto-indent · Ctrl+S: save</span>
    </div>
  </div>
</div>

<style>
  :global(.editor-code),
  .editor-gutter {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    font-size: 12px !important;
    line-height: 1.65 !important;
  }

  :global(.editor-code) {
    white-space: pre !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
  }

  /* One Dark Pro Syntax Highlighting */
  :global(.editor-code .token.comment),
  :global(.editor-code .token.prolog),
  :global(.editor-code .token.doctype),
  :global(.editor-code .token.cdata) {
    color: #6a737d !important;
    font-style: italic !important;
  }

  :global(.editor-code .token.punctuation) {
    color: #abb2bf !important;
  }

  :global(.editor-code .token.property),
  :global(.editor-code .token.tag),
  :global(.editor-code .token.boolean),
  :global(.editor-code .token.number),
  :global(.editor-code .token.constant),
  :global(.editor-code .token.symbol) {
    color: #d19a66 !important;
  }

  :global(.editor-code .token.selector),
  :global(.editor-code .token.attr-name),
  :global(.editor-code .token.string),
  :global(.editor-code .token.char),
  :global(.editor-code .token.builtin) {
    color: #98c379 !important;
  }

  :global(.editor-code .token.operator),
  :global(.editor-code .token.entity),
  :global(.editor-code .token.url) {
    color: #56b6c2 !important;
  }

  :global(.editor-code .token.atrule),
  :global(.editor-code .token.attr-value),
  :global(.editor-code .token.keyword) {
    color: #c678dd !important;
    font-weight: 600 !important;
  }

  :global(.editor-code .token.function),
  :global(.editor-code .token.class-name) {
    color: #61afef !important;
  }

  :global(.editor-code .token.regex),
  :global(.editor-code .token.important),
  :global(.editor-code .token.variable) {
    color: #e06c75 !important;
  }
</style>

