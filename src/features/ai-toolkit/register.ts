import { defineFeature } from "@/lib/feature-registry";
import { setupAiToolkitBackground } from "./background";
import AiToolkit from "./components/AiToolkit.svelte";
import { setupAiToolkitContent } from "./content";

defineFeature({
  id: "ai-toolkit",
  name: "AI Toolkit",
  description: "Export AI chats & Caveman mode",
  icon: "markdown",
  background: setupAiToolkitBackground,
  content: setupAiToolkitContent,
  popup: AiToolkit,
});
