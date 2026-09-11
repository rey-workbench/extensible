import "@/features";
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
    console.log("[WXT] Background service worker ready.");
  },
});
