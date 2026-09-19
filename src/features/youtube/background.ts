import { browser } from "wxt/browser";
import { onMessage } from "@/lib/messaging";
import { YOUTUBE_ACTIONS } from "./constants/youtube.constants";
import { resolveVideo } from "./services/youtube.service";
import type { VideoEntry } from "./types/youtube.types";
import { watchUrl } from "./utils/youtube.utils";

export function setupBackground(): void {
  onMessage<{ id: string; start?: number | null }, boolean>(
    YOUTUBE_ACTIONS.OPEN_VIDEO,
    async (payload) => {
      if (!payload?.id) throw new Error("Missing video id");
      await browser.tabs.create({ url: watchUrl(payload.id, payload.start) });
      return true;
    },
  );

  onMessage<{ id: string }, VideoEntry>(YOUTUBE_ACTIONS.RESOLVE_VIDEO, (payload) => {
    if (!payload?.id) throw new Error("Missing video id");
    return resolveVideo(payload.id);
  });
}
