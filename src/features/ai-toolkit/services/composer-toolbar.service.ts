import { sendMessage } from "@/lib/messaging";
import { readSettings } from "@/lib/utils";
import { AiToolkitComposerView } from "../components/composer.view";
import {
  AI_TOOLKIT_ACTIONS,
  CAVEMAN_LEVELS,
  DEFAULT_CAVEMAN_SETTINGS,
} from "../constants/ai-toolkit.constants";
import type { CavemanSettings, ExportFormat } from "../types/ai-toolkit.types";
import { scrapeConvo } from "../utils/chat-parser.utils";
import { formatMarkdown } from "../utils/export-formatters";
import { cavemanSettingsItem } from "./ai-toolkit.service";
import { setupCavemanInterceptors } from "./caveman-interceptors.service";

export function setupComposerToolbar(initialSettings: CavemanSettings): void {
  let cavemanSettings = initialSettings;

  const view = new AiToolkitComposerView({
    onExport: async (format: ExportFormat) => {
      const convo = await scrapeConvo(document, { hydrate: true, actionLabel: "export" });
      await sendMessage(AI_TOOLKIT_ACTIONS.EXPORT_FILE, { conversation: convo, format });
    },
    onCopy: async () => {
      const convo = await scrapeConvo(document, { actionLabel: "copy" });
      const mdText = formatMarkdown(convo);
      await navigator.clipboard.writeText(mdText);
    },
    onToggleCaveman: async (): Promise<CavemanSettings> => {
      const updated: CavemanSettings = { ...cavemanSettings, enabled: !cavemanSettings.enabled };
      cavemanSettings = updated;
      await cavemanSettingsItem.setValue(updated);
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

      const updated: CavemanSettings = { ...cavemanSettings, enabled: newEnabled, level: newLevel };
      cavemanSettings = updated;
      await cavemanSettingsItem.setValue(updated);
      return updated;
    },
  });
  view.mount(cavemanSettings);

  void cavemanSettingsItem.watch((next) => {
    const updated = readSettings(next, cavemanSettings);
    cavemanSettings = updated;
    view.updateSettings(updated);
  });

  setupCavemanInterceptors(cavemanSettings);
}

export async function loadCavemanSettings(): Promise<CavemanSettings> {
  try {
    return readSettings(await cavemanSettingsItem.getValue(), DEFAULT_CAVEMAN_SETTINGS);
  } catch {
    return DEFAULT_CAVEMAN_SETTINGS;
  }
}
