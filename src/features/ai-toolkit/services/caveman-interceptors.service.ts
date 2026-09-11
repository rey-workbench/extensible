import { readSettings } from "@/lib/utils";
import { isValidCavemanLevel } from "../constants/ai-toolkit.constants";
import type { CavemanSettings } from "../types/ai-toolkit.types";
import {
  hasPrimer,
  hasStop,
  isPrefixed,
  PRIMER_PREFIX,
  STOP_PREFIX,
  wrapStop,
  wrapText,
} from "../utils/caveman-directive.utils";
import { getEditor, getSendButton, getText, setText } from "../utils/chat-composer.utils";
import { parseActivePage } from "../utils/chat-parser.utils";
import { cavemanSettingsItem } from "./ai-toolkit.service";

export function setupCavemanInterceptors(initialSettings: CavemanSettings): void {
  let cavemanSettings = initialSettings;
  let bypass = false;
  let bypassTimer: ReturnType<typeof setTimeout> | null = null;

  void cavemanSettingsItem.watch((next) => {
    cavemanSettings = readSettings(next, cavemanSettings);
  });

  const setBypassThenWrite = (editor: HTMLElement, text: string): void => {
    if (bypassTimer) clearTimeout(bypassTimer);
    bypass = true;
    setText(editor, text);
    bypassTimer = setTimeout(() => {
      bypass = false;
      bypassTimer = null;
    }, 300);
  };

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
