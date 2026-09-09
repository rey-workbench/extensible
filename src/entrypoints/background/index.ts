import "@/features";
import { getFeatures } from "@/lib/feature-registry";
import { isFeatureEnabled } from "@/lib/feature-settings";

export default defineBackground({
  type: "module",
  persistent: false,
  async main() {
    for (const feature of getFeatures()) {
      if (!feature.background) continue;
      // Mandatory (host) features are always enabled.
      if (!feature.mandatory && !(await isFeatureEnabled(feature.id))) {
        console.debug(`[WXT] "${feature.id}" disabled — skipping background setup.`);
        continue;
      }
      try {
        await feature.background();
      } catch (err) {
        console.warn(`[WXT] "${feature.id}" background setup failed:`, err);
      }
    }
    console.log("[WXT] Background service worker ready.");
  },
});
