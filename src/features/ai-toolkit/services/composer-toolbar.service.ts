import { APP_ACTIONS, APP_COMMANDS, COPY_MESSAGES, copyWithFeedback } from "@/lib/browser";
import { onMessage, sendMessage } from "@/lib/messaging";
import { readSettings } from "@/lib/utils";
import { AiToolkitComposerView } from "../components/composer.view";
import { AI_TOOLKIT_ACTIONS, CAVEMAN_LEVELS } from "../constants/ai-toolkit.constants";
import type { CavemanSettings, ExportFormat } from "../types/ai-toolkit.types";
import { scrapeConvo } from "../utils/chat-parser.utils";
import { formatMarkdown } from "../utils/export-formatters";
import { cavemanSettingsItem, updateCavemanSettings } from "./ai-toolkit.service";
import { setupCavemanInterceptors } from "./caveman-interceptors.service";

export function setupComposerToolbar(initialSettings: CavemanSettings): void {
  let cavemanSettings = initialSettings;

  const exportChat = async (format: ExportFormat) => {
    view.setBusy(true, format === "pdf" ? "Preparing…" : "Exporting…");
    try {
      const convo = await scrapeConvo(document, { hydrate: true, actionLabel: "export" });
      await sendMessage(AI_TOOLKIT_ACTIONS.EXPORT_FILE, { conversation: convo, format });
    } finally {
      view.setBusy(false);
    }
  };

  const view = new AiToolkitComposerView({
    onExport: exportChat,
    onCopy: async () => {
      view.setBusy(true, "Copying…");
      try {
        const convo = await scrapeConvo(document, { actionLabel: "copy" });
        const mdText = formatMarkdown(convo);
        const message = await copyWithFeedback(mdText);
        if (message !== COPY_MESSAGES.success) throw new Error(message);
      } finally {
        view.setBusy(false);
      }
    },
    onToggleCaveman: async (): Promise<CavemanSettings> => {
      const updated = await updateCavemanSettings({
        enabled: !cavemanSettings.enabled,
      });
      cavemanSettings = updated;
      return updated;
    },
    onCycleCavemanLevel: async (): Promise<CavemanSettings> => {
      let newEnabled = cavemanSettings.enabled;
      let newLevel: CavemanSettings["level"] = cavemanSettings.level;

      if (!cavemanSettings.enabled) {
        newEnabled = true;
        newLevel = "lite";
      } else {
        const currentIndex = CAVEMAN_LEVELS.indexOf(cavemanSettings.level);
        if (currentIndex === CAVEMAN_LEVELS.length - 1) {
          newEnabled = false;
          newLevel = "full";
        } else {
          newLevel = CAVEMAN_LEVELS[currentIndex + 1];
        }
      }

      const updated = await updateCavemanSettings({ enabled: newEnabled, level: newLevel });
      cavemanSettings = updated;
      return updated;
    },
  });
  view.mount(cavemanSettings);

  onMessage<{ command?: string } | null, boolean>(APP_ACTIONS.COMMAND, (payload) => {
    if (payload?.command !== APP_COMMANDS.EXPORT_CHAT) return false;
    void exportChat("markdown");
    return true;
  });

  void cavemanSettingsItem.watch((next) => {
    const updated = readSettings(next, cavemanSettings);
    cavemanSettings = updated;
    view.updateSettings(updated);
  });

  setupCavemanInterceptors(cavemanSettings);
}
