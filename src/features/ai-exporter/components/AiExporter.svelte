<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "wxt/browser";
  import Badge from "@/components/Badge.svelte";
  import Button from "@/components/Button.svelte";
  import Card from "@/components/Card.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import SectionHeader from "@/components/SectionHeader.svelte";
  import { copyToClipboard, slugify } from "@/lib/browser";
  import { sendMessage, sendToTab } from "@/lib/messaging";
  import { delay } from "@/lib/utils";
  import {
    AI_EXPORTER_ACTIONS,
    AI_PLATFORMS,
    CAVEMAN_HINTS,
    CAVEMAN_LEVELS,
    type CavemanLevel,
    DEFAULT_CAVEMAN_SETTINGS,
  } from "../constants/ai-exporter.constants";
  import { AiExporterService } from "../services/ai-exporter.service";
  import type { CavemanSettings, ChatConversation, ExportFormat, ExportHistoryItem } from "../types/ai-exporter.types";
  import { ChatParserUtils } from "../utils/chat-parser.utils";
  import { MarkdownFormatterUtils } from "../utils/markdown-formatter.utils";

  const service = new AiExporterService();

  let convo = $state<ChatConversation | null>(null);
  let history = $state<ExportHistoryItem[]>([]);
  let caveman = $state<CavemanSettings>(DEFAULT_CAVEMAN_SETTINGS);
  let isLoading = $state(false);
  let status = $state<{ text: string; isError?: boolean } | null>(null);
  let statusTimer: ReturnType<typeof setTimeout> | null = null;

  function showStatus(text: string, isError = false): void {
    status = { text, isError };
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (status?.text === text) status = null;
    }, 2500);
  }

  async function requestConvo(tabId: number, deepHydrate: boolean): Promise<ChatConversation | null> {
    const res = await sendToTab<{ conversation?: ChatConversation | null }>(
      tabId,
      AI_EXPORTER_ACTIONS.SCRAPE_DOM,
      { hydrate: deepHydrate }
    );
    return res?.conversation ?? null;
  }

  async function detectActiveTabChat(deepHydrate = false): Promise<void> {
    isLoading = true;
    try {
      const isExtensionPopup = typeof location !== "undefined" && location.protocol === "chrome-extension:";
      if (!isExtensionPopup && typeof document !== "undefined") {
        try {
          if (deepHydrate) await ChatParserUtils.hydrateVirtualizedChat(document);
          convo = ChatParserUtils.parseActivePage(document);
          return;
        } catch (err) {
          console.warn("[AiExporter] Direct DOM scrape error:", err);
        }
      }
      if (!browser.tabs?.query) return;
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) return;
      let c: ChatConversation | null = null;
      try {
        c = await requestConvo(activeTab.id, deepHydrate);
      } catch {
        if (browser.scripting?.executeScript && activeTab.id) {
          try {
            await browser.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["/content-scripts/content.js"],
            });
            await delay(200);
            c = await requestConvo(activeTab.id, deepHydrate);
          } catch {
            // content script not injectable — leave convo as null
          }
        }
      }
      convo = c;
    } catch {
      convo = null;
    } finally {
      isLoading = false;
    }
  }

  async function loadHistory(): Promise<void> {
    try {
      history = await service.getHistory();
    } catch (err) {
      console.warn("[AiExporter] Failed to load history:", err);
    }
  }

  async function handleExport(format: ExportFormat): Promise<void> {
    if (!convo) return;
    isLoading = true;
    try {
      await sendMessage(AI_EXPORTER_ACTIONS.EXPORT_FILE, { conversation: convo, format });
      await loadHistory();
      showStatus(format === "pdf" ? "Print dialog opened!" : `Exported as ${format.toUpperCase()}!`);
    } catch {
      showStatus("Export failed", true);
    } finally {
      isLoading = false;
    }
  }

  async function handleCopy(): Promise<void> {
    if (!convo) return;
    isLoading = true;
    try {
      const mdText = MarkdownFormatterUtils.format(convo);
      const ok = await copyToClipboard(mdText);
      showStatus(ok ? "Copied to clipboard!" : "Copy failed", !ok);
    } catch {
      showStatus("Copy failed", true);
    } finally {
      isLoading = false;
    }
  }

  async function handleDownloadHistory(id: string): Promise<void> {
    const item = history.find((x) => x.id === id);
    if (!item?.content) return;
    const { mimeType, extension } = AiExporterService.formatMeta(item.format);
    const filename = `${item.platform}_${slugify(item.title).slice(0, 40) || "chat"}_${item.exportedAt}${extension}`;
    try {
      await sendMessage(AI_EXPORTER_ACTIONS.DOWNLOAD_CONTENT, { content: item.content, filename, mimeType });
      showStatus("Re-downloaded!");
    } catch {
      showStatus("Download failed", true);
    }
  }

  async function handleCopyHistory(id: string): Promise<void> {
    const item = history.find((x) => x.id === id);
    if (!item?.content) return;
    const ok = await copyToClipboard(item.content);
    showStatus(ok ? "Copied from history!" : "Copy failed", !ok);
  }

  async function handleDeleteHistory(id: string): Promise<void> {
    await service.deleteHistoryItem(id);
    await loadHistory();
    showStatus("Item removed");
  }

  async function handleClearHistory(): Promise<void> {
    await service.clearHistory();
    await loadHistory();
    showStatus("History cleared");
  }

  async function handleToggleCaveman(enabled: boolean): Promise<void> {
    caveman = await service.updateCavemanSettings({ enabled });
    showStatus(enabled ? "Caveman Mode enabled" : "Caveman Mode disabled");
  }

  async function handleSetLevel(level: CavemanLevel): Promise<void> {
    caveman = await service.updateCavemanSettings({ level });
    showStatus(`Caveman level: ${level.toUpperCase()}`);
  }

  onMount(async () => {
    try {
      caveman = await service.getCavemanSettings();
    } catch {
      // fall back to defaults
    }
    await Promise.all([loadHistory(), detectActiveTabChat(false)]);
  });

  const cavemanHint = $derived(CAVEMAN_HINTS[caveman.level] || "");
  const platformConfig = $derived(convo ? (AI_PLATFORMS[convo.platform] || AI_PLATFORMS.generic) : null);
  const isChatGpt = $derived(convo?.platform === "chatgpt");
</script>

<div class="flex flex-col gap-2 p-2">
  {#if status}
    <div
      class="rounded-md border px-2 py-1.5 text-[11px] font-medium
        {status.isError ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}"
    >
      {status.text}
    </div>
  {/if}

  {#if !convo}
    <Card title="Active AI Session">
      {#snippet headerAction()}<Badge text="Not Detected" variant="neutral" />{/snippet}
      <div class="flex flex-col items-center gap-2 py-2 text-center">
        <p class="text-xs text-slate-500">
          Navigate to ChatGPT, Claude, Gemini, or DeepSeek to export your conversations.
        </p>
        <Button size="sm" variant="secondary" disabled={isLoading} onclick={() => detectActiveTabChat(false)}
          >Inspect Active Tab</Button>
      </div>
    </Card>
  {:else}
    <Card title="Active AI Session">
      {#snippet headerAction()}<Badge
          text={platformConfig?.name ?? "AI Chat"}
          variant={isChatGpt ? "success" : "primary"}
        />{/snippet}
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-1">
          <h4 class="truncate text-sm font-semibold text-slate-800" title={convo.title}>{convo.title}</h4>
          <div class="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Badge text={`${convo.messages.length} messages`} variant="primary" />
            {#if convo.totalWords}
              <span class="text-slate-400">•</span><span>{convo.totalWords.toLocaleString()} words</span>
            {/if}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <Button size="sm" variant="primary" icon="markdown" disabled={isLoading} onclick={() => handleExport("markdown")}
            >Markdown (.md)</Button>
          <Button size="sm" variant="secondary" icon="pdf" disabled={isLoading} onclick={() => handleExport("pdf")}
            >Print to PDF</Button>
          <Button size="sm" variant="secondary" icon="json" disabled={isLoading} onclick={() => handleExport("json")}
            >JSON (.json)</Button>
          <Button size="sm" variant="secondary" icon="html" disabled={isLoading} onclick={() => handleExport("html")}
            >HTML Document</Button>
          <Button size="sm" variant="secondary" icon="copy" disabled={isLoading} onclick={handleCopy}>Copy Text</Button>
          <Button size="sm" variant="secondary" icon="refresh" disabled={isLoading} onclick={() => detectActiveTabChat(true)}
            >Scrape All Turns</Button>
        </div>
      </div>
    </Card>
  {/if}

  <Card title="Caveman Mode">
    {#snippet headerAction()}<Badge text={caveman.enabled ? "ON" : "OFF"} variant={caveman.enabled ? "warning" : "neutral"} />{/snippet}
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-col">
          <span class="text-xs font-medium text-slate-700">Terse Response Mode</span>
          <span class="text-[11px] text-slate-500">Strip fluff, pleasantries &amp; hedging. Retain 100% technical code &amp; substance.</span>
        </div>
        <label class="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            class="peer sr-only"
            checked={caveman.enabled}
            onchange={(e) => handleToggleCaveman((e.target as HTMLInputElement).checked)}
          />
          <span
            class="h-4 w-8 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:after:translate-x-4"
          ></span>
        </label>
      </div>
      <div class="flex items-center gap-2">
        <span class="shrink-0 text-[11px] font-medium text-slate-600">Intensity:</span>
        <div class="flex gap-1">
          {#each CAVEMAN_LEVELS as lvl}
            <button
              type="button"
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors
                {caveman.level === lvl
                  ? 'bg-ext-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
              onclick={() => handleSetLevel(lvl as CavemanLevel)}
            >{lvl}</button>
          {/each}
        </div>
      </div>
      <div class="text-[11px] italic text-slate-400">{cavemanHint}</div>
    </div>
  </Card>

  <SectionHeader title="Export History">
    {#snippet badge()}
      {#if history.length > 0}<Badge text={String(history.length)} variant="neutral" />{/if}
    {/snippet}
    {#snippet action()}
      {#if history.length > 0}<Button size="sm" variant="ghost" disabled={isLoading} onclick={handleClearHistory}
          >Clear</Button>{/if}
    {/snippet}
  </SectionHeader>

  {#if history.length === 0}
    <EmptyState title="No exported chats yet" subtitle="Exported sessions will be recorded here." />
  {:else}
    <div class="flex flex-col gap-1">
      {#each history as item (item.id)}
        {@const dateStr = new Date(item.exportedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {@const platformName = AI_PLATFORMS[item.platform]?.name || item.platform}
        <div class="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2 py-1.5 hover:bg-slate-50">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"
              ><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-medium text-slate-700">{item.title}</div>
            <div class="truncate text-[11px] text-slate-400">
              {platformName} • {item.format.toUpperCase()} • {dateStr}
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            {#if item.content}
              <button
                type="button"
                class="inline-flex h-5.5 w-5.5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                title="Re-download"
                aria-label="Re-download"
                onclick={() => handleDownloadHistory(item.id)}><Icon name="download" size={14} /></button>
              <button
                type="button"
                class="inline-flex h-5.5 w-5.5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                title="Copy Content"
                aria-label="Copy Content"
                onclick={() => handleCopyHistory(item.id)}><Icon name="copy" size={14} /></button>
            {/if}
            <button
              type="button"
              class="inline-flex h-5.5 w-5.5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Delete"
              aria-label="Delete"
              onclick={() => handleDeleteHistory(item.id)}><Icon name="trash" size={14} /></button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>