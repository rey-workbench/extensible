import { MessageRouterService, StorageService } from "@/core/index";
import {
  AI_EXPORTER_ACTIONS,
  AI_EXPORTER_STORAGE_KEYS,
  CAVEMAN_LEVELS,
  type CavemanLevel,
  DEFAULT_CAVEMAN_SETTINGS,
  isValidCavemanLevel,
} from "../constants/ai-exporter.constants";
import type { CavemanSettings, ChatConversation, ExportFormat } from "../types/ai-exporter.types";
import { CavemanDirectiveUtils } from "../utils/caveman-directive.utils";
import { ChatComposerUtils } from "../utils/chat-composer.utils";
import { ChatParserUtils } from "../utils/chat-parser.utils";
import { MarkdownFormatterUtils } from "../utils/markdown-formatter.utils";
import { AiExporterComposerView } from "../views/ai-exporter-composer.view";

export class AiExporterContentController {
  public static readonly contextType = "content" as const;
  public static readonly inject = [MessageRouterService, StorageService] as const;

  private view: AiExporterComposerView | null = null;
  private cavemanSettings: CavemanSettings = DEFAULT_CAVEMAN_SETTINGS;
  private unwatchSettings: (() => void) | null = null;
  private bypass = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;

  constructor(
    private readonly router: MessageRouterService,
    private readonly storage: StorageService
  ) {}

  public async onModuleInit(): Promise<void> {
    // 1. Register content script handler for scraping DOM when requested by Popup
    this.router.subscribe(
      AI_EXPORTER_ACTIONS.SCRAPE_DOM,
      async (payload?: {
        hydrate?: boolean;
      }): Promise<{ conversation: ChatConversation | null }> => {
        if (payload?.hydrate) {
          await ChatParserUtils.hydrateVirtualizedChat(document);
        }
        const convo = ChatParserUtils.parseActivePage(document);
        return { conversation: convo };
      }
    );

    // 2. Fetch initial Caveman settings directly from StorageService (no background message port needed)
    try {
      const saved = await this.storage.get<CavemanSettings>(
        AI_EXPORTER_STORAGE_KEYS.CAVEMAN_SETTINGS,
        DEFAULT_CAVEMAN_SETTINGS
      );
      this.cavemanSettings = saved || DEFAULT_CAVEMAN_SETTINGS;
    } catch {
      // Fallback default
    }

    // 3. Reactively sync setting changes from popup without message ports
    this.unwatchSettings = this.storage.watch<CavemanSettings>(
      AI_EXPORTER_STORAGE_KEYS.CAVEMAN_SETTINGS,
      (newSettings) => {
        if (newSettings) {
          this.cavemanSettings = newSettings;
          this.view?.updateSettings(this.cavemanSettings);
        }
      }
    );

    // 4. Initialize in-composer unified toolbar ONLY on supported AI platforms (chatgpt, claude, gemini, deepseek)
    const platform = ChatParserUtils.detectPlatform(window.location.hostname);
    if (platform === "generic") {
      return;
    }

    this.initComposerToolbar();
    this.bindCavemanInterceptors();
  }

  private initComposerToolbar(): void {
    if (this.view) return;

    this.view = new AiExporterComposerView({
      onExport: async (format: ExportFormat) => {
        const convo = await ChatParserUtils.scrapeConvo(document, {
          hydrate: true,
          actionLabel: "export",
        });
        await this.router.send(AI_EXPORTER_ACTIONS.EXPORT_FILE, {
          conversation: convo,
          format,
        });
      },
      onCopy: async () => {
        const convo = await ChatParserUtils.scrapeConvo(document, { actionLabel: "copy" });
        const mdText = MarkdownFormatterUtils.format(convo);
        await navigator.clipboard.writeText(mdText);
      },
      onToggleCaveman: async (): Promise<CavemanSettings> => {
        const updated: CavemanSettings = {
          ...this.cavemanSettings,
          enabled: !this.cavemanSettings.enabled,
        };
        this.cavemanSettings = updated;
        await this.storage.set(AI_EXPORTER_STORAGE_KEYS.CAVEMAN_SETTINGS, updated);
        return updated;
      },
      onCycleCavemanLevel: async (): Promise<CavemanSettings> => {
        let newEnabled = this.cavemanSettings.enabled;
        let newLevel: CavemanLevel = this.cavemanSettings.level;

        if (!this.cavemanSettings.enabled) {
          newEnabled = true;
          newLevel = "lite";
        } else {
          const currentIndex = CAVEMAN_LEVELS.indexOf(this.cavemanSettings.level);
          if (currentIndex === CAVEMAN_LEVELS.length - 1) {
            newEnabled = false;
            newLevel = "full";
          } else {
            newLevel = CAVEMAN_LEVELS[currentIndex + 1];
          }
        }

        const updated: CavemanSettings = {
          ...this.cavemanSettings,
          enabled: newEnabled,
          level: newLevel,
        };
        this.cavemanSettings = updated;
        await this.storage.set(AI_EXPORTER_STORAGE_KEYS.CAVEMAN_SETTINGS, updated);
        return updated;
      },
    });

    this.view.mount(this.cavemanSettings);
  }

  private bindCavemanInterceptors(): void {
    if (this.keydownListener) return;

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      this.handleCavemanInjection();
    };

    this.clickListener = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const sendBtn = ChatComposerUtils.getSendButton(document);
      if (sendBtn && (target === sendBtn || sendBtn.contains(target))) {
        this.handleCavemanInjection();
      }
    };

    window.addEventListener("keydown", this.keydownListener, true);
    window.addEventListener("click", this.clickListener, true);
  }

  private handleCavemanInjection(): void {
    if (this.bypass || !this.cavemanSettings.enabled) return;

    const platform = ChatParserUtils.detectPlatform(window.location.hostname);
    if (platform === "generic") return;

    const host = window.location.hostname.replace(/^www\./, "");
    if (this.cavemanSettings.sites[host] === false) return;

    const editor = ChatComposerUtils.getEditor(document);
    if (!editor) return;

    const raw = ChatComposerUtils.getText(editor);
    if (!raw.trim() || CavemanDirectiveUtils.isPrefixed(raw)) return;

    const convo = ChatParserUtils.parseActivePage(document);

    // If chat has no messages OR previous bubbles don't have Caveman mode, send full primer!
    let hasPrimerInChat = CavemanDirectiveUtils.hasPrimer(convo?.messages);
    if (!hasPrimerInChat) {
      // Secondary check in DOM text in case virtualized DOM hasn't rendered offscreen items
      const mainChat =
        document.querySelector(
          'main, #chat-history, [class*="conversation"], [class*="chat-container"]'
        ) || document.body;
      if (mainChat?.textContent?.includes("[Caveman mode is ON")) {
        hasPrimerInChat = true;
      }
    }

    // Mirror fallback for stop detection (virtualized DOM may hide earlier turns)
    let hasStopInChat = CavemanDirectiveUtils.hasStop(convo?.messages);
    if (!hasStopInChat) {
      const mainChat =
        document.querySelector(
          'main, #chat-history, [class*="conversation"], [class*="chat-container"]'
        ) || document.body;
      if (mainChat?.textContent?.includes("[stop caveman mode")) {
        hasStopInChat = true;
      }
    }

    const level = this.cavemanSettings.level;
    // Unknown/stale level: inject the stop directive — but only when this chat was
    // actually primed; a never-primed chat has nothing to stop, so skip entirely.
    if (!isValidCavemanLevel(level) && !hasPrimerInChat) return;

    // Mode OFF but this chat was already primed: inject the stop directive once so
    // the model actually stops replying tersely (toggle-off alone reaches the chat).
    const stopNeeded =
      (!this.cavemanSettings.enabled || !isValidCavemanLevel(level)) &&
      hasPrimerInChat &&
      !hasStopInChat;
    if (stopNeeded) {
      this.bypass = true;
      ChatComposerUtils.setText(editor, CavemanDirectiveUtils.wrapStop(raw));
      setTimeout(() => {
        this.bypass = false;
      }, 300);
      return;
    }

    // Mode inactive (or stop already sent): leave the message untouched.
    if (!this.cavemanSettings.enabled || !isValidCavemanLevel(level)) return;

    const wrapped = CavemanDirectiveUtils.wrapText(raw, !hasPrimerInChat, level);

    this.bypass = true;
    ChatComposerUtils.setText(editor, wrapped);
    setTimeout(() => {
      this.bypass = false;
    }, 300);
  }

  public onModuleDestroy(): void {
    if (this.unwatchSettings) {
      this.unwatchSettings();
      this.unwatchSettings = null;
    }
    if (this.view) {
      this.view.unmount();
      this.view = null;
    }
    if (this.keydownListener) {
      window.removeEventListener("keydown", this.keydownListener, true);
      this.keydownListener = null;
    }
    if (this.clickListener) {
      window.removeEventListener("click", this.clickListener, true);
      this.clickListener = null;
    }
  }
}
