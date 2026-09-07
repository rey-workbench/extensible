import { CoreModule, type ModuleDefinition } from '@/core/index';
import { TempMailModule } from '@/modules/temp-mail/index';

/**
 * Root Application Module importing Core and all active feature modules.
 */
export const AppModule: ModuleDefinition = {
  id: 'app',
  name: 'App Root',
  module: 'AppModule',
  imports: [
    CoreModule,
    TempMailModule
  ],
  controllers: [],
  providers: []
} as const;
