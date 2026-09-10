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
import { CavemanDirectiveUtils } from "./utils/caveman-directive.utils";
import { ChatComposerUtils } from "./utils/chat-composer.utils";
import { ChatParserUtils } from "./utils/chat-parser.utils";
import { MarkdownFormatterUtils } from "./utils/markdown-formatter.utils";
import { AiToolkitComposerView } from "./views/composer.view";

/**
 * AI Toolkit content-side setup: DOM scrape handler + floating composer toolbar
 * (Caveman toggle / export menu) + caveman send interceptors on AI chat pages.
 */
export async function setupAiToolkitContent(): Promise<void> {
  // 1. Register content script handler for scraping DOM when requested by Popup
  onMessage<{ hydrate?: boolean } | null, { conversation: ChatConversation | null }>(
    AI_TOOLKIT_ACTIONS.SCRAPE_DOM,
    async (payload) => {
      try {
        if (payload?.hydrate) {
          await ChatParserUtils.hydrateVirtualizedChat(document);
        }
        return { conversation: ChatParserUtils.parseActivePage(document) };
      } catch (err) {
        console.warn("[AiToolkit] SCRAPE_DOM failed:", err);
        return { conversation: null };
      }
    }
  );

  // 2. Composer toolbar + caveman interceptors only on supported AI platforms
  const platform = ChatParserUtils.detectPlatform(window.location.hostname);
  if (platform === "generic") return;

  let cavemanSettings: CavemanSettings = DEFAULT_CAVEMAN_SETTINGS;
  try {
    cavemanSettings = readSettings(await cavemanSettingsItem.getValue(), DEFAULT_CAVEMAN_SETTINGS);
  } catch {
    // fall back to defaults
  }

  const view = new AiToolkitComposerView({
    onExport: async (format: ExportFormat) => {
      const convo = await ChatParserUtils.scrapeConvo(document, {
        hydrate: true,
        actionLabel: "export",
      });
      await sendMessage(AI_TOOLKIT_ACTIONS.EXPORT_FILE, { conversation: convo, format });
    },
    onCopy: async () => {
      const convo = await ChatParserUtils.scrapeConvo(document, { actionLabel: "copy" });
      const mdText = MarkdownFormatterUtils.format(convo);
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

  // 3. Reactively sync settings changes from the popup / drawer
  void cavemanSettingsItem.watch((next) => {
    const updated = readSettings(next, cavemanSettings);
    cavemanSettings = updated;
    view.updateSettings(updated);
  });

  // 4. Caveman send interceptors (Enter / send-button click)
  let bypass = false;
  let bypassTimer: ReturnType<typeof setTimeout> | null = null;

  const handleCavemanInjection = (): void => {
    if (bypass) return;

    const platform = ChatParserUtils.detectPlatform(window.location.hostname);
    if (platform === "generic") return;

    const host = window.location.hostname.replace(/^www\./, "");
    if (cavemanSettings.sites[host] === false) return;

    const editor = ChatComposerUtils.getEditor(document);
    if (!editor) return;

    const raw = ChatComposerUtils.getText(editor);
    if (!raw.trim() || CavemanDirectiveUtils.isPrefixed(raw)) return;

    const modeActive = cavemanSettings.enabled && isValidCavemanLevel(cavemanSettings.level);

    const mainChat =
      document.querySelector(
        'main, #chat-history, [class*="conversation"], [class*="chat-container"]'
      ) || document.body;
    const chatText = mainChat?.textContent ?? "";

    if (!modeActive && !chatText.includes(CavemanDirectiveUtils.PRIMER_PREFIX)) return;

    const convo = ChatParserUtils.parseActivePage(document);
    const hasPrimerInChat =
      CavemanDirectiveUtils.hasPrimer(convo?.messages) ||
      chatText.includes(CavemanDirectiveUtils.PRIMER_PREFIX);
    const hasStopInChat =
      CavemanDirectiveUtils.hasStop(convo?.messages) ||
      chatText.includes(CavemanDirectiveUtils.STOP_PREFIX);

    if (!modeActive && !hasPrimerInChat) return;

    if (!modeActive) {
      if (!hasStopInChat) {
        setBypassThenWrite(editor, CavemanDirectiveUtils.wrapStop(raw));
      }
      return;
    }

    const wrapped = CavemanDirectiveUtils.wrapText(raw, !hasPrimerInChat, cavemanSettings.level);
    setBypassThenWrite(editor, wrapped);
  };

  const setBypassThenWrite = (editor: HTMLElement, text: string): void => {
    if (bypassTimer) clearTimeout(bypassTimer);
    bypass = true;
    ChatComposerUtils.setText(editor, text);
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
    const sendBtn = ChatComposerUtils.getSendButton(document);
    if (sendBtn && (target === sendBtn || sendBtn.contains(target))) {
      handleCavemanInjection();
    }
  };

  window.addEventListener("keydown", keydownListener, true);
  window.addEventListener("click", clickListener, true);
}
