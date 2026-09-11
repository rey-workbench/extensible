import { onMessage, sendMessage } from "@/lib/messaging";
import { readSettings } from "@/lib/utils";
import {
  AI_TOOLKIT_ACTIONS,
  CAVEMAN_LEVELS,
  type CavemanLevel,
  DEFAULT_CAVEMAN_SETTINGS,
  isValidCavemanLevel,
} from "./constants/ai-toolkit.constants";
import { cavemanSettingsItem } from "./services/ai-toolkit.service";
import type { CavemanSettings, ChatConversation, ExportFormat } from "./types/ai-toolkit.types";
import {
  hasPrimer,
  hasStop,
  isPrefixed,
  PRIMER_PREFIX,
  STOP_PREFIX,
  wrapStop,
  wrapText,
} from "./utils/caveman-directive.utils";
import { getEditor, getSendButton, getText, setText } from "./utils/chat-composer.utils";
import {
  detectPlatform,
  hydrateVirtualizedChat,
  parseActivePage,
  scrapeConvo,
} from "./utils/chat-parser.utils";
import { formatMarkdown } from "./utils/export-formatters";
import { AiToolkitComposerView } from "./views/composer.view";

export async function setupAiToolkitContent(): Promise<void> {
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

  let cavemanSettings: CavemanSettings = DEFAULT_CAVEMAN_SETTINGS;
  try {
    cavemanSettings = readSettings(await cavemanSettingsItem.getValue(), DEFAULT_CAVEMAN_SETTINGS);
  } catch {}

  const view = new AiToolkitComposerView({
    onExport: async (format: ExportFormat) => {
      const convo = await scrapeConvo(document, {
        hydrate: true,
        actionLabel: "export",
      });
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
      let newLevel: CavemanLevel = cavemanSettings.level;

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

  let bypass = false;
  let bypassTimer: ReturnType<typeof setTimeout> | null = null;

  const handleCavemanInjection = (): void => {
    if (bypass) return;

    const host = window.location.hostname.replace(/^www\./, "");
    if (cavemanSettings.sites[host] === false) return;

    const editor = getEditor(document);
    if (!editor) return;

    const raw = getText(editor);
    if (!raw.trim() || isPrefixed(raw)) return;

    const modeActive = cavemanSettings.enabled && isValidCavemanLevel(cavemanSettings.level);

    const mainChat =
      document.querySelector(
        'main, #chat-history, [class*="conversation"], [class*="chat-container"]',
      ) || document.body;
    const chatText = mainChat?.textContent ?? "";

    if (!modeActive && !chatText.includes(PRIMER_PREFIX)) return;

    const convo = parseActivePage(document);
    const hasPrimerInChat = hasPrimer(convo?.messages) || chatText.includes(PRIMER_PREFIX);
    const hasStopInChat = hasStop(convo?.messages) || chatText.includes(STOP_PREFIX);

    if (!modeActive && !hasPrimerInChat) return;

    if (!modeActive) {
      if (!hasStopInChat) {
        setBypassThenWrite(editor, wrapStop(raw));
      }
      return;
    }

    const wrapped = wrapText(raw, !hasPrimerInChat, cavemanSettings.level);
    setBypassThenWrite(editor, wrapped);
  };

  const setBypassThenWrite = (editor: HTMLElement, text: string): void => {
    if (bypassTimer) clearTimeout(bypassTimer);
    bypass = true;
    setText(editor, text);
    bypassTimer = setTimeout(() => {
      bypass = false;
      bypassTimer = null;
    }, 300);
  };

  const keydownListener = (e: KeyboardEvent): void => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    handleCavemanInjection();
  };

  const clickListener = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const sendBtn = getSendButton(document);
    if (sendBtn && (target === sendBtn || sendBtn.contains(target))) {
      handleCavemanInjection();
    }
  };

  window.addEventListener("keydown", keydownListener, true);
  window.addEventListener("click", clickListener, true);
}
