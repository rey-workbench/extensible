import { defineFeature } from "@/lib/feature-registry";
import { setupAiToolkitBackground } from "./background";
import AiToolkit from "./components/AiToolkit.svelte";

defineFeature({
  id: "ai-toolkit",
  name: "AI Toolkit",
  description: "Export AI chats & Caveman mode",
  icon: "markdown",
  color: "#2D8C4E",
  background: setupAiToolkitBackground,
  content: async () => {
    const { setupAiToolkitContent } = await import("./content");
    return setupAiToolkitContent();
  },
  popup: AiToolkit,
});
