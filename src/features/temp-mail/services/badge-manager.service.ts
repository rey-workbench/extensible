import { mount, unmount } from "svelte";
import { setNativeValue } from "@/lib/browser";
import { sendMessage } from "@/lib/messaging";
import {
  createShadowHost,
  markUiClicks,
  rescueClicksIn,
  shieldKeysFromHost,
} from "@/lib/shadow-ui";
import TempMailBadge from "../components/TempMailBadge.svelte";
import { TEMPMAIL_ACTIONS } from "../constants/temp-mail.constants";
import { isEmailField } from "../utils/temp-mail.utils";
import { tempMailSettings } from "./temp-mail.service";

const BADGE_CSS = `
  @keyframes aio-badge-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;

interface BadgeEntry {
  unmount: () => void;
  input: HTMLInputElement;
}

export async function setupBadges(): Promise<void> {
  let settings = await tempMailSettings.getValue();
  const badges = new Map<HTMLInputElement, BadgeEntry>();

  const ui = createShadowHost("aio-tempmail-badge-host", BADGE_CSS);
  if (!ui) return;
  const { host, shadow } = ui;
  markUiClicks(shadow);
  const disposeRescue = rescueClicksIn(host);
  shieldKeysFromHost(host);

  function attach(input: HTMLInputElement): void {
    if (badges.has(input)) return;
    const component = mount(TempMailBadge, {
      target: shadow,
      props: {
        target: input,
        onFill: async () => {
          const email = await sendMessage<{ address: string }>(TEMPMAIL_ACTIONS.GENERATE_NEW);
          if (!email?.address) return null;
          setNativeValue(input, email.address);
          return email.address;
        },
      },
    });
    badges.set(input, {
      unmount: () => unmount(component),
      input,
    });
  }

  function scan(): void {
    if (!settings.showFloatingButton) return;
    for (const input of document.querySelectorAll<HTMLInputElement>("input")) {
      if (isEmailField(input)) attach(input);
    }
  }

  function prune(): void {
    for (const [input, entry] of badges) {
      if (!document.contains(input)) {
        entry.unmount();
        badges.delete(input);
      }
    }
  }

  function teardown(): void {
    clearTimeout(scanTimer);
    for (const entry of badges.values()) entry.unmount();
    badges.clear();
  }

  scan();

  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scan();
      prune();
    }, 200);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("pagehide", () => disposeRescue(), { once: true });

  void tempMailSettings.watch((next) => {
    const prev = settings;
    settings = next;
    if (next.showFloatingButton && !prev.showFloatingButton) scan();
    if (!next.showFloatingButton && prev.showFloatingButton) teardown();
  });
}
