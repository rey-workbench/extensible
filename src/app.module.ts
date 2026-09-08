import { CoreModule, type ModuleDefinition } from "@/core/index";
import { AiExporterModule } from "@/modules/ai-exporter/index";
import { TempMailModule } from "@/modules/temp-mail/index";

/**
 * Root Application Module importing Core and all active feature modules.
 */
export const AppModule: ModuleDefinition = {
  id: "app",
  name: "App Root",
  module: "AppModule",
  imports: [CoreModule, TempMailModule, AiExporterModule],
  controllers: [],
  providers: [],
} as const;
