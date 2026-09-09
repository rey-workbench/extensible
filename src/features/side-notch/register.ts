import { defineFeature } from "@/lib/feature-registry";
import { setupSideNotchContent } from "./content";

defineFeature({
  id: "side-notch",
  name: "Quick Dock",
  description: "Floating panel with quick access to all features",
  icon: "sidebar",
  /** Host/shell UI — always enabled, hidden from feature lists. */
  mandatory: true,
  content: setupSideNotchContent,
});
