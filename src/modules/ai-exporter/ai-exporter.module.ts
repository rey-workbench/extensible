import { CoreModule, type ModuleDefinition } from "@/core/index";
import { renderIcon } from "@/shared/index";
import { AiExporterService } from "./ai-exporter.service";
import { AiExporterBackgroundController } from "./controllers/ai-exporter-background.controller";
import { AiExporterContentController } from "./controllers/ai-exporter-content.controller";
import { AiExporterPopupController } from "./controllers/ai-exporter-popup.controller";

/**
 * AiExporterModule bundling Service, Controllers, and Views for multi-platform AI chat extraction.
 */
export const AiExporterModule: ModuleDefinition = {
  id: "ai-exporter",
  name: "AI Exporter",
  description: "Export AI chats to Markdown, JSON, HTML, or clipboard",
  icon: renderIcon("download", 20, "", "", "color: #10a37f;"),
  module: "AiExporterModule",
  imports: [CoreModule],
  controllers: [
    AiExporterBackgroundController,
    AiExporterContentController,
    AiExporterPopupController,
  ],
  providers: [AiExporterService],
  exports: [AiExporterService],
} as const;
