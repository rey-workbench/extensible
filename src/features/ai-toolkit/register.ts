import { defineFeature } from "@/lib/feature-registry";
import { setupBackground } from "./background";
import AiToolkit from "./components/AiToolkit.svelte";

defineFeature({
  id: "ai-toolkit",
  name: "AI Toolkit",
  description: "Export AI chats & Caveman mode",
  icon: "markdown",
  color: "#2D8C4E",
  background: setupBackground,
  content: () => import("./content").then((m) => m.setupContent()),
  popup: AiToolkit,
});
