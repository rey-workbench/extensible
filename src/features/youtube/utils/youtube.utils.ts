import { YOUTUBE_CONFIG, YOUTUBE_URLS } from "../constants/youtube.constants";
import type { PlayerGeometry, VideoEntry, Viewport } from "../types/youtube.types";

function idFrom(value: string): string | null {
  const candidate = value.split(/[/?#&]/)[0];
  return YOUTUBE_CONFIG.ID_PATTERN.test(candidate) ? candidate : null;
}

export function parseVideoId(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (YOUTUBE_CONFIG.ID_PATTERN.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.includes("//") ? raw : `${YOUTUBE_URLS.SCHEME}${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return idFrom(url.pathname.slice(1));
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return idFrom(fromQuery);

  const fromPath = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
  return fromPath ? idFrom(fromPath[1]) : null;
}

export function parseStartSeconds(input: string | null | undefined): number | null {
  const raw = (input ?? "").trim();
  const match = raw.match(/[?&#](?:t|start)=([0-9hms]+)/i);
  const value = (match?.[1] ?? "").toLowerCase();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value) > 0 ? Number(value) : null;

  const parts = value.match(/(\d+)(h|m|s)/g);
  if (!parts) return null;
  const seconds = parts.reduce((total, part) => {
    const amount = Number(part.slice(0, -1));
    const unit = part.slice(-1);
    return total + amount * (unit === "h" ? 3600 : unit === "m" ? 60 : 1);
  }, 0);
  return seconds > 0 ? seconds : null;
}

export function watchUrl(id: string, start?: number | null): string {
  return `${YOUTUBE_URLS.WATCH}${id}${start ? `&t=${start}` : ""}`;
}

export function thumbnailUrl(id: string): string {
  return `${YOUTUBE_URLS.THUMBNAIL}${id}/hqdefault.jpg`;
}

export function embedUrl(
  id: string,
  opts: { start?: number | null; origin?: string } = {},
): string {
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (opts.start) params.set("start", String(opts.start));
  if (opts.origin) params.set("origin", opts.origin);
  return `${YOUTUBE_URLS.EMBED}${id}?${params.toString()}`;
}

export function embedOrigin(href: string | undefined): string {
  try {
    const url = new URL(href ?? "");

    return url.protocol === "chrome-extension:" ? `${url.protocol}//${url.host}` : "";
  } catch {
    return "";
  }
}

export function oembedUrl(id: string): string {
  return `${YOUTUBE_URLS.OEMBED}?url=${encodeURIComponent(watchUrl(id))}&format=json`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function defaultPlayerGeometry(viewport: Viewport): PlayerGeometry {
  const width = clamp(
    Math.round(viewport.width * 0.32),
    YOUTUBE_CONFIG.PLAYER_MIN_WIDTH,
    Math.min(YOUTUBE_CONFIG.PLAYER_WIDTH, viewport.width),
  );
  const height = Math.round((width * 9) / 16) + 44;
  return clampPlayerGeometry(
    {
      x: viewport.width - width - YOUTUBE_CONFIG.PLAYER_EDGE_GAP,
      y: viewport.height - height - YOUTUBE_CONFIG.PLAYER_EDGE_GAP,
      width,
      height,
    },
    viewport,
  );
}

export function clampPlayerGeometry(geometry: PlayerGeometry, viewport: Viewport): PlayerGeometry {
  const maxWidth = Math.max(YOUTUBE_CONFIG.PLAYER_MIN_WIDTH, viewport.width);
  const maxHeight = Math.max(YOUTUBE_CONFIG.PLAYER_MIN_HEIGHT, viewport.height);
  const width = clamp(geometry.width, YOUTUBE_CONFIG.PLAYER_MIN_WIDTH, maxWidth);
  const height = clamp(geometry.height, YOUTUBE_CONFIG.PLAYER_MIN_HEIGHT, maxHeight);

  return {
    width,
    height,
    x: clamp(geometry.x, 0, Math.max(0, viewport.width - width)),
    y: clamp(geometry.y, 0, Math.max(0, viewport.height - height)),
  };
}

export function readPlayerGeometry(raw: unknown, viewport: Viewport): PlayerGeometry {
  const stored = raw as Partial<PlayerGeometry> | null | undefined;
  const numbers = [stored?.x, stored?.y, stored?.width, stored?.height];
  if (!numbers.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return defaultPlayerGeometry(viewport);
  }
  return clampPlayerGeometry(stored as PlayerGeometry, viewport);
}

export function toEntry(
  id: string,
  title?: string,
  author?: string,
  addedAt = Date.now(),
): VideoEntry {
  const clean = (title ?? "").trim();
  return { id, title: clean || id, author: (author ?? "").trim(), addedAt };
}
