import { mount, unmount } from "svelte";
import { setInputValue } from "@/lib/browser";
import { onMessage, sendMessage } from "@/lib/messaging";
import TempMailBadge from "./components/TempMailBadge.svelte";
import { TEMPMAIL_ACTIONS } from "./constants/temp-mail.constants";
import { tempMailSettings } from "./services/temp-mail.service";
import { TempMailUtils } from "./utils/temp-mail.utils";

interface BadgeEntry {
  unmount: () => void;
  input: HTMLInputElement;
}

/** TempMail content-side setup: email autofill handler + floating fill badges. */
export async function setupTempMailContent(): Promise<void> {
  // Fill an email field on request (context menu / popup autofill)
  onMessage<{ email?: string } | null, boolean>(TEMPMAIL_ACTIONS.AUTOFILL_EMAIL, (payload) => {
    const email = payload?.email;
    if (!email) return false;

    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLInputElement && TempMailUtils.isEmailField(activeEl)) {
      setInputValue(activeEl, email);
      return true;
    }
    for (const input of document.querySelectorAll<HTMLInputElement>("input")) {
      if (TempMailUtils.isEmailField(input)) {
        setInputValue(input, email);
        return true;
      }
    }
    return false;
  });

  await setupBadges();
}

async function setupBadges(): Promise<void> {
  let settings = await tempMailSettings.getValue();
  const badges = new Map<HTMLInputElement, BadgeEntry>();

  function attach(input: HTMLInputElement): void {
    if (badges.has(input)) return;
    const component = mount(TempMailBadge, {
      target: document.body,
      props: {
        target: input,
        onFill: async () => {
          const email = await sendMessage<{ address: string }>(TEMPMAIL_ACTIONS.GENERATE_NEW);
          if (!email?.address) return null;
          setInputValue(input, email.address);
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
      if (TempMailUtils.isEmailField(input)) attach(input);
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
    for (const entry of badges.values()) entry.unmount();
    badges.clear();
  }

  scan();

  const observer = new MutationObserver(() => {
    scan();
    prune();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  void tempMailSettings.watch((next) => {
    const prev = settings;
    settings = next;
    if (next.showFloatingButton && !prev.showFloatingButton) scan();
    if (!next.showFloatingButton && prev.showFloatingButton) teardown();
  });
}
