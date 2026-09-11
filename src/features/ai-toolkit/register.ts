import { defineFeature } from "@/lib/feature-registry";
import { setupAiToolkitBackground } from "./background";
import AiToolkit from "./components/AiToolkit.svelte";
import { setupAiToolkitContent } from "./content";

defineFeature({
  id: "ai-toolkit",
  name: "AI Toolkit",
  description: "Export AI chats & Caveman mode",
  icon: "markdown",
  color: "#2D8C4E",
  background: setupAiToolkitBackground,
  content: setupAiToolkitContent,
  popup: AiToolkit,
});
