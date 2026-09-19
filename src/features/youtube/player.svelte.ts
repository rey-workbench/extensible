import type { VideoEntry } from "./types/youtube.types";

export const youtubePlayer = $state<{ video: VideoEntry | null; start: number | null }>({
  video: null,
  start: null,
});

export function playVideo(video: VideoEntry, start: number | null = null): void {
  youtubePlayer.video = video;
  youtubePlayer.start = start;
}

export function stopVideo(): void {
  youtubePlayer.video = null;
  youtubePlayer.start = null;
}
