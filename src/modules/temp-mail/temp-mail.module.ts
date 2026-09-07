import { CoreModule, type ModuleDefinition } from '@/core/index';
import { TempMailBackgroundController } from '@/modules/temp-mail/controllers/temp-mail-background.controller';
import { TempMailContentController } from '@/modules/temp-mail/controllers/temp-mail-content.controller';
import { TempMailPopupController } from '@/modules/temp-mail/controllers/temp-mail-popup.controller';
import { TempMailService } from '@/modules/temp-mail/temp-mail.service';

/**
 * TempMailModule bundling the Service, Controllers, and Views for Temporary Email feature.
 */
export const TempMailModule: ModuleDefinition = {
  id: 'temp-mail',
  name: 'Temp Mail',
  description: 'Disposable temporary email address',
  icon: '<svg viewBox="0 0 24 24" width="20" height="20" style="color: #ea4335;"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  module: 'TempMailModule',
  imports: [
    CoreModule
  ],
  controllers: [
    TempMailBackgroundController,
    TempMailContentController,
    TempMailPopupController
  ],
  providers: [
    TempMailService
  ],
  exports: [
    TempMailService
  ]
} as const;
