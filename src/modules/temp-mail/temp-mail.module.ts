import { CoreModule, type ModuleDefinition } from "@/core/index";
import { TempMailBackgroundController } from "@/modules/temp-mail/controllers/temp-mail-background.controller";
import { TempMailContentController } from "@/modules/temp-mail/controllers/temp-mail-content.controller";
import { TempMailPopupController } from "@/modules/temp-mail/controllers/temp-mail-popup.controller";
import { TempMailService } from "@/modules/temp-mail/temp-mail.service";
import { renderIcon } from "@/shared/index";

/**
 * TempMailModule bundling the Service, Controllers, and Views for Temporary Email feature.
 */
export const TempMailModule: ModuleDefinition = {
  id: "temp-mail",
  name: "Temp Mail",
  description: "Disposable temporary email address",
  icon: renderIcon("mail", 20, "", "", "color: #ea4335;"),
  module: "TempMailModule",
  imports: [CoreModule],
  controllers: [TempMailBackgroundController, TempMailContentController, TempMailPopupController],
  providers: [TempMailService],
  exports: [TempMailService],
} as const;
