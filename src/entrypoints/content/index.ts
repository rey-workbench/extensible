import "@/features";
import { getFeatures } from "@/lib/feature-registry";
import { isFeatureEnabled } from "@/lib/feature-settings";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  async main() {
    for (const feature of getFeatures()) {
      if (!feature.content) continue;
      if (!feature.mandatory && !(await isFeatureEnabled(feature.id))) continue;
      try {
        await feature.content();
      } catch (err) {
        console.error(`[WXT] "${feature.id}" content setup failed:`, err);
      }
    }
  },
});
