import { browser } from "wxt/browser";
import "@/features";
import { APP_ACTIONS } from "@/lib/browser";
import { onMessage, sendToTab } from "@/lib/messaging";
import { getFeatures } from "@/lib/feature-registry";
import { isFeatureEnabled } from "@/lib/feature-settings";

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

    console.log("[WXT] Background service worker ready.");
  },
});
