import { EventBusService } from "@/core/services/event-bus.service";
import { MessageRouterService } from "@/core/services/message-router.service";
import { StorageService } from "@/core/services/storage.service";
import type { ModuleDefinition } from "@/core/types/index";

export const CoreModule: ModuleDefinition = {
  id: "core",
  name: "Core Module",
  module: "CoreModule",
  providers: [StorageService, EventBusService, MessageRouterService],
  exports: [StorageService, EventBusService, MessageRouterService],
} as const;
