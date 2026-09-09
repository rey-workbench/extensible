import { defineFeature } from "@/lib/feature-registry";
import { setupAiExporterBackground } from "./background";
import AiExporter from "./components/AiExporter.svelte";
import { setupAiExporterContent } from "./content";

defineFeature({
  id: "ai-exporter",
  name: "AI Exporter",
  description: "Export AI chats & Caveman mode",
  icon: "markdown",
  background: setupAiExporterBackground,
  content: setupAiExporterContent,
  popup: AiExporter,
});
