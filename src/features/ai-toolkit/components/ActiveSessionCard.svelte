<script lang="ts">
  import Badge from "@/components/Badge.svelte";
  import Button from "@/components/Button.svelte";
  import Card from "@/components/Card.svelte";
  import { AI_PLATFORMS } from "../constants/ai-toolkit.constants";
  import type { ChatConversation, ExportFormat } from "../types/ai-toolkit.types";

  interface Props {
    convo: ChatConversation | null;
    isLoading: boolean;
    onInspect: (deep: boolean) => void;
    onExport: (format: ExportFormat) => void;
    onCopy: () => void;
  }
  let { convo, isLoading, onInspect, onExport, onCopy }: Props = $props();

  const platformConfig = $derived(
    convo ? AI_PLATFORMS[convo.platform] || AI_PLATFORMS.generic : null,
  );
  const isChatGpt = $derived(convo?.platform === "chatgpt");
</script>

{#if !convo}
  <Card title="Active AI Session">
    {#snippet headerAction()}<Badge text="Not Detected" variant="neutral" />{/snippet}
    <div class="flex flex-col items-center gap-2 py-2 text-center">
      <p class="text-xs font-medium text-ext-text-secondary">
        Navigate to ChatGPT, Claude, Gemini, or DeepSeek to export your
        conversations.
      </p>
      <Button
        size="sm"
        variant="secondary"
        disabled={isLoading}
        onclick={() => onInspect(false)}>Inspect Active Tab</Button
      >
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
        <h4 class="truncate text-sm font-bold text-ext-text" title={convo.title}>
          {convo.title}
        </h4>
        <div class="flex items-center gap-1.5 text-[11px] text-ext-text-secondary">
          <Badge text={`${convo.messages.length} messages`} variant="primary" />
          {#if convo.totalWords}
            <span class="text-ext-muted">•</span><span class="font-semibold"
              >{convo.totalWords.toLocaleString()} words</span
            >
          {/if}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="primary"
          icon="markdown"
          disabled={isLoading}
          onclick={() => onExport("markdown")}>Markdown (.md)</Button
        >
        <Button
          size="sm"
          variant="secondary"
          icon="pdf"
          disabled={isLoading}
          onclick={() => onExport("pdf")}>Print to PDF</Button
        >
        <Button
          size="sm"
          variant="secondary"
          icon="json"
          disabled={isLoading}
          onclick={() => onExport("json")}>JSON (.json)</Button
        >
        <Button
          size="sm"
          variant="secondary"
          icon="html"
          disabled={isLoading}
          onclick={() => onExport("html")}>HTML Document</Button
        >
        <Button
          size="sm"
          variant="secondary"
          icon="copy"
          disabled={isLoading}
          onclick={onCopy}>Copy Text</Button
        >
        <Button
          size="sm"
          variant="secondary"
          icon="refresh"
          disabled={isLoading}
          onclick={() => onInspect(true)}>Scrape All Turns</Button
        >
      </div>
    </div>
  </Card>
{/if}