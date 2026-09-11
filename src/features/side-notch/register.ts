import { defineFeature } from "@/lib/feature-registry";

defineFeature({
  id: "side-notch",
  name: "Quick Dock",
  description: "Floating panel with quick access to all features",
  icon: "sidebar",
  color: "#1B4DDB",
  mandatory: true,
  content: () => import("./content").then((m) => m.setupContent()),
});
