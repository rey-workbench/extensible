<script lang="ts">
  import { onMount } from "svelte";
  import Button from "@/components/Button.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import SectionHeader from "@/components/SectionHeader.svelte";
  import { copyAndReport, formatRelativeTime } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { showToast } from "@/lib/toast";
  import { YOUTUBE_ACTIONS } from "../constants/youtube.constants";
  import { playVideo, stopVideo, youtubePlayer } from "../player.svelte";
  import {
    addRecent,
    clearRecents,
    getRecents,
    removeRecent,
  } from "../services/youtube.service";
  import type { VideoEntry } from "../types/youtube.types";
  import {
    embedOrigin,
    embedUrl,
    parseStartSeconds,
    parseVideoId,
    thumbnailUrl,
    toEntry,
    watchUrl,
  } from "../utils/youtube.utils";

  let recents = $state<VideoEntry[]>([]);
  let input = $state("");
  let active = $state<VideoEntry | null>(null);
  let start = $state<number | null>(null);
  let playing = $state(false);
  let busy = $state(false);
  let rootEl = $state<HTMLElement | null>(null);

  
  
  let floating = $state(false);

  const activeStart = $derived(floating ? youtubePlayer.start : start);

  const origin = embedOrigin(typeof location === "undefined" ? "" : location.href);

  onMount(async () => {
    
    
    floating = rootEl ? rootEl.getRootNode() instanceof ShadowRoot : false;
    recents = await getRecents();
  });

  function notify(message: string, isError = false): void {
    if (rootEl) showToast(rootEl, message, { isError });
  }

  function play(entry: VideoEntry, from?: number | null): void {
    if (floating) {
      playVideo(entry, from ?? null);
      return;
    }
    active = entry;
    start = from ?? null;
    playing = true;
  }

  async function playInput(): Promise<void> {
    if (busy) return;
    const raw = input;
    const id = parseVideoId(raw);
    if (!id) {
      notify("That doesn't look like a YouTube link", true);
      return;
    }
    busy = true;
    try {
      
      
      const entry = await sendMessage<VideoEntry>(YOUTUBE_ACTIONS.RESOLVE_VIDEO, { id }).catch(() =>
        toEntry(id),
      );
      recents = await addRecent(entry);
      play(entry, parseStartSeconds(raw));
      input = "";
    } finally {
      busy = false;
    }
  }

  async function openInTab(entry: VideoEntry): Promise<void> {
    try {
      await sendMessage(YOUTUBE_ACTIONS.OPEN_VIDEO, { id: entry.id, start: activeStart });
    } catch {
      window.open(watchUrl(entry.id, activeStart), "_blank", "noopener");
    }
  }

  async function copyLink(entry: VideoEntry): Promise<void> {
    await copyAndReport(watchUrl(entry.id), (message, isError) => notify(message, isError));
  }

  async function forget(entry: VideoEntry): Promise<void> {
    recents = await removeRecent(entry.id);
    if (youtubePlayer.video?.id === entry.id) stopVideo();
    if (active?.id === entry.id) {
      active = null;
      playing = false;
    }
  }

  async function forgetAll(): Promise<void> {
    await clearRecents();
    recents = [];
    active = null;
    playing = false;
    stopVideo();
  }
</script>

<div bind:this={rootEl} class="flex flex-col gap-3 p-2.5">
  <form
    class="flex items-center gap-2"
    onsubmit={(e) => {
      e.preventDefault();
      void playInput();
    }}
  >
    <input
      class="ext-field h-9 min-w-0 flex-1 rounded-lg px-3 text-body font-medium"
      type="text"
      placeholder="Paste a YouTube link or video id…"
      autocomplete="off"
      spellcheck="false"
      bind:value={input}
      aria-label="YouTube link or video id"
    />
    <Button variant="primary" icon="play" disabled={busy} onclick={() => void playInput()}>
      Play
    </Button>
  </form>

  {#if floating}
    {#if youtubePlayer.video}
      {@const current = youtubePlayer.video}
      <div class="ext-card flex items-center gap-3 rounded-2xl p-2.5">
        <span
          class="relative h-11 w-19 shrink-0 overflow-hidden rounded-lg border border-ext-border bg-black"
        >
          <img src={thumbnailUrl(current.id)} alt="" class="h-full w-full object-cover" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-body font-bold text-ext-text">{current.title}</div>
          <div class="truncate text-label text-ext-muted">
            Playing in the floating window — drag it anywhere
          </div>
        </div>
        <button
          type="button"
          class="ext-icon-btn h-7 w-7"
          title="Open on YouTube"
          onclick={() => void openInTab(current)}
        >
          <Icon name="external" size={13} />
        </button>
        <button
          type="button"
          class="ext-icon-btn ext-icon-btn-danger h-7 w-7"
          title="Close player"
          onclick={stopVideo}
        >
          <Icon name="close" size={13} />
        </button>
      </div>
    {/if}
  {:else if active}
    {@const video = active}
    <div class="overflow-hidden rounded-2xl border border-ext-border bg-black">
      <div class="relative aspect-video w-full">
        <img src={thumbnailUrl(video.id)} alt="" class="absolute inset-0 h-full w-full object-cover" />
        {#if playing}
          <iframe
            class="absolute inset-0 h-full w-full"
            src={embedUrl(video.id, { start, origin })}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="no-referrer"
            allowfullscreen
          ></iframe>
        {:else}
          <button
            type="button"
            class="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/45"
            aria-label="Play {video.title}"
            onclick={() => (playing = true)}
          >
            <span
              class="flex h-14 w-14 items-center justify-center rounded-full bg-ext-primary text-white shadow-lg"
            >
              <Icon name="play" size={26} />
            </span>
          </button>
        {/if}
      </div>
      <div class="flex items-center gap-2 px-3 py-2.5">
        <div class="min-w-0 flex-1">
          <div class="truncate text-body font-bold text-ext-text">{video.title}</div>
          <div class="truncate text-label text-ext-muted">
            {video.author || "YouTube"}
          </div>
        </div>
        <button
          type="button"
          class="ext-icon-btn h-7 w-7"
          title="Copy link"
          onclick={() => void copyLink(video)}
        >
          <Icon name="copy" size={13} />
        </button>
        <button
          type="button"
          class="ext-icon-btn h-7 w-7"
          title="Open on YouTube"
          onclick={() => void openInTab(video)}
        >
          <Icon name="external" size={13} />
        </button>
      </div>
    </div>
  {/if}

  {#snippet countBadge()}
    <span
      class="ext-count-pill"
      >{recents.length}</span
    >
  {/snippet}

  {#snippet clearAction()}
    <button
      type="button"
      class="ext-icon-btn h-7 w-7"
      title="Clear recent videos"
      onclick={() => void forgetAll()}
    >
      <Icon name="trash" size={12} />
    </button>
  {/snippet}

  <SectionHeader
    title="Recent"
    badge={countBadge}
    action={recents.length > 0 ? clearAction : undefined}
  />

  {#if recents.length === 0}
    <EmptyState
      title="No videos yet"
      subtitle="Paste a YouTube link above and press Play. The last videos stay here so you can jump back in."
    />
  {:else}
    <div class="flex flex-col gap-1.5">
      {#each recents as item (item.id)}
        <div
          class="ext-card flex cursor-pointer items-center gap-3 rounded-2xl p-2.5 transition-all hover:scale-[1.01] hover:shadow-md"
          role="button"
          tabindex="0"
          onclick={() => play(item)}
          onkeydown={(e) => e.key === "Enter" && play(item)}
        >
          <span
            class="relative h-11 w-19 shrink-0 overflow-hidden rounded-lg border border-ext-border bg-ext-subtle"
          >
            <img
              src={thumbnailUrl(item.id)}
              alt=""
              loading="lazy"
              class="h-full w-full object-cover"
            />
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-body font-bold text-ext-text">{item.title}</div>
            <div class="truncate text-label text-ext-muted">
              {item.author || formatRelativeTime(item.addedAt)}
            </div>
          </div>
          <button
            type="button"
            class="ext-icon-btn h-7 w-7"
            title="Copy link"
            onclick={(e) => {
              e.stopPropagation();
              void copyLink(item);
            }}
          >
            <Icon name="copy" size={13} />
          </button>
          <button
            type="button"
            class="ext-icon-btn ext-icon-btn-danger h-7 w-7"
            title="Remove from recents"
            onclick={(e) => {
              e.stopPropagation();
              void forget(item);
            }}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
