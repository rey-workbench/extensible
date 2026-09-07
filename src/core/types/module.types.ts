import type { ClassConstructor } from '@/core/types/context.types';

/**
 * Module metadata and registry contracts for the DI container.
 */
export interface ModuleDefinition {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  module?: any;
  imports?: readonly any[];
  controllers?: readonly any[];
  providers?: readonly any[];
  exports?: readonly any[];
}

export interface RegisteredModule {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly moduleDef: ModuleDefinition;
  readonly moduleClass: any;
  readonly controllers: readonly any[];
  readonly exports: readonly any[];
}

export interface PopupViewController {
  mount(container: HTMLElement): Promise<void> | void;
  unmount?(): void;
  onModuleDestroy?(): void;
}
