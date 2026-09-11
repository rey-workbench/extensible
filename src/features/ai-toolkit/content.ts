import { onMessage } from "@/lib/messaging";
import { AI_TOOLKIT_ACTIONS } from "./constants/ai-toolkit.constants";
import { loadCavemanSettings, setupComposerToolbar } from "./services/composer-toolbar.service";
import type { ChatConversation } from "./types/ai-toolkit.types";
import { detectPlatform, hydrateVirtualizedChat, parseActivePage } from "./utils/chat-parser.utils";

export async function setupContent(): Promise<void> {
  onMessage<{ hydrate?: boolean } | null, { conversation: ChatConversation | null }>(
    AI_TOOLKIT_ACTIONS.SCRAPE_DOM,
    async (payload) => {
      try {
        if (payload?.hydrate) {
          await hydrateVirtualizedChat(document);
        }
        return { conversation: parseActivePage(document) };
      } catch (err) {
        console.warn("[AiToolkit] SCRAPE_DOM failed:", err);
        return { conversation: null };
      }
    },
  );

  const platform = detectPlatform(window.location.hostname);
  if (platform === "generic") return;

  await setupComposerToolbar(await loadCavemanSettings());
}
