import { storage } from "wxt/utils/storage";
import { YOUTUBE_CONFIG, YOUTUBE_STORAGE_KEYS } from "../constants/youtube.constants";
import type { PlayerGeometry, VideoEntry, Viewport } from "../types/youtube.types";
import { oembedUrl, readPlayerGeometry, toEntry } from "../utils/youtube.utils";

const recentsItem = storage.defineItem<VideoEntry[]>(YOUTUBE_STORAGE_KEYS.RECENTS, {
  defaultValue: [],
});

const playerItem = storage.defineItem<PlayerGeometry>(YOUTUBE_STORAGE_KEYS.PLAYER);

export async function getPlayerGeometry(viewport: Viewport): Promise<PlayerGeometry> {
  try {
    return readPlayerGeometry(await playerItem.getValue(), viewport);
  } catch {
    return readPlayerGeometry(null, viewport);
  }
}

export async function savePlayerGeometry(geometry: PlayerGeometry): Promise<void> {
  try {
    await playerItem.setValue(geometry);
  } catch {}
}

export function getRecents(): Promise<VideoEntry[]> {
  return recentsItem.getValue();
}

export async function addRecent(entry: VideoEntry): Promise<VideoEntry[]> {
  const current = await recentsItem.getValue();
  const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(
    0,
    YOUTUBE_CONFIG.RECENTS_LIMIT,
  );
  await recentsItem.setValue(next);
  return next;
}

export async function removeRecent(id: string): Promise<VideoEntry[]> {
  const next = (await recentsItem.getValue()).filter((item) => item.id !== id);
  await recentsItem.setValue(next);
  return next;
}

export async function clearRecents(): Promise<void> {
  await recentsItem.setValue([]);
}

export async function resolveVideo(id: string): Promise<VideoEntry> {
  const fallback = toEntry(id);
  try {
    const res = await fetch(oembedUrl(id), {
      signal: AbortSignal.timeout(YOUTUBE_CONFIG.REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return toEntry(id, data.title, data.author_name, fallback.addedAt);
  } catch {
    return fallback;
  }
}
