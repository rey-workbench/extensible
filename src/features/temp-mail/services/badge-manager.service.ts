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
  @keyframes ext-badge-spin {
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

  const ui = createShadowHost("ext-tempmail-badge-host", BADGE_CSS);
  if (!ui) return;
  const { host, shadow } = ui;
  markUiClicks(shadow);
  const disposeRescue = rescueClicksIn(host);
  const disposeShield = shieldKeysFromHost(host);

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

  function scanWithin(nodes: readonly Node[]): void {
    if (!settings.showFloatingButton) return;
    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      if (node instanceof HTMLInputElement && isEmailField(node)) attach(node);
      for (const input of node.querySelectorAll<HTMLInputElement>("input")) {
        if (isEmailField(input)) attach(input);
      }
    }
  }

  function onFocusIn(event: Event): void {
    if (!settings.showFloatingButton) return;
    const target = event.target;
    if (target instanceof HTMLInputElement && isEmailField(target)) attach(target);
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
    document.removeEventListener("focusin", onFocusIn, true);
    observer.disconnect();
    disposeRescue();
    disposeShield();
    for (const entry of badges.values()) entry.unmount();
    badges.clear();
  }

  scan();

  let scanTimer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver((records) => {
    const added: Node[] = [];
    let removed = false;
    for (const record of records) {
      if (record.type === "childList" && record.addedNodes.length > 0) {
        added.push(...record.addedNodes);
      } else if (record.type === "childList") {
        removed = true;
      }
    }
    if (added.length > 0) scanWithin(added);
    if (!removed) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(prune, 200);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("focusin", onFocusIn, true);

  window.addEventListener("pagehide", () => disposeRescue(), { once: true });

  void tempMailSettings.watch((next) => {
    const prev = settings;
    settings = next;
    if (next.showFloatingButton && !prev.showFloatingButton) scan();
    if (!next.showFloatingButton && prev.showFloatingButton) teardown();
  });
}
