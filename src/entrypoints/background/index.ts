import "@/features";
import { getFeatures } from "@/lib/feature-registry";
import { isFeatureEnabled } from "@/lib/feature-settings";

export default defineBackground({
  type: "module",
  persistent: false,
  main() {
    // MV3: message listeners must be registered synchronously on the first
    // event-loop turn. Chrome won't wake an idle service worker for events
    // whose listeners were added after an await — the sender then fails with
    // "Could not establish connection. Receiving end does not exist."
    // feature.background() registers onMessage handlers, so it runs before any
    // async work. Handlers of disabled features stay registered but inert:
    // nothing sends them messages while the feature is off.
    for (const feature of getFeatures()) {
      if (!feature.background) continue;
      try {
        feature.background();
      } catch (err) {
        console.warn(`[WXT] "${feature.id}" background setup failed:`, err);
      }
    }

    // Debug-only: report features that are switched off.
    void (async () => {
      for (const feature of getFeatures()) {
        if (!feature.background || feature.mandatory) continue;
        if (!(await isFeatureEnabled(feature.id))) {
          console.debug(`[WXT] "${feature.id}" disabled — background handlers idle.`);
        }
      }
    })();
    console.log("[WXT] Background service worker ready.");
  },
});
