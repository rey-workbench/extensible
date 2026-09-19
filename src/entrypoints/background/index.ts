import { browser } from "wxt/browser";
import "@/features";
import { APP_ACTIONS, APP_COMMANDS } from "@/lib/browser";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getFeatures } from "@/lib/feature-registry";
import { onMessage, sendToTab } from "@/lib/messaging";

export default defineBackground({
  type: "module",
  persistent: false,
  main() {
    for (const feature of getFeatures()) {
      if (!feature.background) continue;
      try {
        feature.background();
      } catch (err) {
        console.warn(`[WXT] "${feature.id}" background setup failed:`, err);
      }
    }

    void (async () => {
      for (const feature of getFeatures()) {
        if (!feature.background || feature.mandatory) continue;
        if (!(await isFeatureEnabled(feature.id))) {
          console.debug(`[WXT] "${feature.id}" disabled — background handlers idle.`);
        }
      }
    })();

    onMessage<Record<string, unknown>, boolean>(
      APP_ACTIONS.OPEN_LAUNCHER,
      async (_payload, sender) => {
        let tabId = sender.tab?.id;
        if (tabId == null) {
          const [active] = await browser.tabs.query({
            active: true,
            lastFocusedWindow: true,
          });
          tabId = active?.id;
        }
        if (tabId == null) return false;
        await sendToTab(tabId, APP_ACTIONS.OPEN_LAUNCHER);
        return true;
      },
    );

    browser.commands?.onCommand.addListener((command) => {
      void runCommand(command);
    });

    console.debug("[Extensible] Background service worker ready.");
  },
});

async function runCommand(command: string): Promise<void> {
  const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.id != null) {
    try {
      await sendToTab(active.id, APP_ACTIONS.COMMAND, { command });
      return;
    } catch {
      // No content script on this page (chrome://, web store, PDF, …).
    }
  }

  if (command === APP_COMMANDS.COPY_TEMP_EMAIL) {
    await browser.action?.openPopup?.().catch(() => {});
  }
}
