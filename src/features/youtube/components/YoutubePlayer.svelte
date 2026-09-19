<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@/components/Icon.svelte";
  import { copyAndReport } from "@/lib/browser";
  import { showToast } from "@/lib/toast";
  import { stopVideo, youtubePlayer } from "../player.svelte";
  import { getPlayerGeometry, savePlayerGeometry } from "../services/youtube.service";
  import {
    clampPlayerGeometry,
    defaultPlayerGeometry,
    embedOrigin,
    embedUrl,
    watchUrl,
  } from "../utils/youtube.utils";

  const FALLBACK_VIEWPORT = { width: 1280, height: 800 };

  let windowEl = $state<HTMLElement | null>(null);
  let drag: { dx: number; dy: number } | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const video = $derived(youtubePlayer.video);

  const origin = embedOrigin(typeof location === "undefined" ? "" : location.href);

  function viewport(): { width: number; height: number } {
    if (typeof window === "undefined") return FALLBACK_VIEWPORT;
    
    
    return {
      width: window.innerWidth || FALLBACK_VIEWPORT.width,
      height: window.innerHeight || FALLBACK_VIEWPORT.height,
    };
  }

  let geometry = $state(defaultPlayerGeometry(viewport()));

  
  let box = $state({ width: 0, height: 0 });

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void savePlayerGeometry({
        x: geometry.x,
        y: geometry.y,
        width: box.width || geometry.width,
        height: box.height || geometry.height,
      });
    }, 350);
  }

  onMount(() => {
    void getPlayerGeometry(viewport()).then((stored) => {
      geometry = stored;
      box = { width: stored.width, height: stored.height };
    });

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      box = { width: Math.round(rect.width), height: Math.round(rect.height) };
      scheduleSave();
    });
    if (windowEl) observer.observe(windowEl);

    const onViewportResize = (): void => {
      geometry = clampPlayerGeometry(geometry, viewport());
      box = { width: geometry.width, height: geometry.height };
      scheduleSave();
    };
    window.addEventListener("resize", onViewportResize);

    
    
    
    const viewportObserver = new ResizeObserver(onViewportResize);
    viewportObserver.observe(document.documentElement);
    const frame = requestAnimationFrame(onViewportResize);

    return () => {
      observer.disconnect();
      viewportObserver.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onViewportResize);
      if (saveTimer) clearTimeout(saveTimer);
    };
  });

  function startDrag(e: PointerEvent): void {
    if (e.button !== 0) return;
    
    if ((e.target as HTMLElement | null)?.closest("button")) return;
    const handle = e.currentTarget as HTMLElement;
    drag = { dx: e.clientX - geometry.x, dy: e.clientY - geometry.y };
    handle.setPointerCapture(e.pointerId);
  }

  function onDrag(e: PointerEvent): void {
    if (!drag) return;
    geometry = clampPlayerGeometry(
      { ...geometry, x: e.clientX - drag.dx, y: e.clientY - drag.dy },
      viewport(),
    );
  }

  function endDrag(e: PointerEvent): void {
    if (!drag) return;
    drag = null;
    const handle = e.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    scheduleSave();
  }

  async function copyLink(id: string): Promise<void> {
    await copyAndReport(watchUrl(id), (message, isError) => {
      if (windowEl) showToast(windowEl, message, { isError, durationMs: 1500 });
    });
  }

  async function openInTab(id: string): Promise<void> {
    window.open(watchUrl(id, youtubePlayer.start), "_blank", "noopener");
  }
</script>

{#if video}
  <div
    bind:this={windowEl}
    class="ext-float-player flex flex-col"
    style:left="{geometry.x}px"
    style:top="{geometry.y}px"
    style:width="{geometry.width}px"
    style:height="{geometry.height}px"
    role="dialog"
    aria-label="Floating YouTube player"
  >
    <header
      class="ext-float-drag flex shrink-0 items-center gap-2 border-b border-ext-border bg-ext-subtle/60 px-3 py-2"
      role="toolbar"
      aria-label="Floating player controls"
      tabindex="-1"
      onpointerdown={startDrag}
      onpointermove={onDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
    >
      <div class="min-w-0 flex-1">
        <div class="truncate text-label font-bold text-ext-text">{video.title}</div>
        <div class="truncate text-[11px] text-ext-muted">{video.author || "YouTube"}</div>
      </div>
      <button
        type="button"
        class="ext-icon-btn h-6 w-6"
        title="Copy link"
        onclick={() => void copyLink(video.id)}
      >
        <Icon name="copy" size={12} />
      </button>
      <button
        type="button"
        class="ext-icon-btn h-6 w-6"
        title="Open on YouTube"
        onclick={() => void openInTab(video.id)}
      >
        <Icon name="external" size={12} />
      </button>
      <button
        type="button"
        class="ext-icon-btn ext-icon-btn-danger h-6 w-6"
        title="Close player"
        onclick={stopVideo}
      >
        <Icon name="close" size={12} />
      </button>
    </header>

    <div class="min-h-0 flex-1 bg-black">
      <iframe
        class="h-full w-full"
        src={embedUrl(video.id, { start: youtubePlayer.start, origin })}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="no-referrer"
        allowfullscreen
      ></iframe>
    </div>
  </div>
{/if}
