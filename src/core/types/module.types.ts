/**
 * Module metadata and registry contracts for the DI container.
 */
import type { ClassConstructor, TokenKey } from "@/core/types/context.types";

interface ClassProvider<T = unknown> {
  provide: TokenKey;
  useClass: ClassConstructor<T>;
}

interface ValueProvider<T = unknown> {
  provide: TokenKey;
  useValue: T;
}

export type Provider = ClassConstructor | ClassProvider | ValueProvider;

export interface ModuleDefinition {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  module?: string;
  imports?: readonly ModuleDefinition[];
  controllers?: readonly ClassConstructor[];
  providers?: readonly Provider[];
  exports?: readonly TokenKey[];
}

export interface RegisteredModule {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly moduleDef: ModuleDefinition;
  readonly moduleClass: TokenKey;
  readonly controllers: readonly object[];
  readonly exports: readonly TokenKey[];
}

export interface PopupViewController {
  mount(container: HTMLElement): Promise<void> | void;
  unmount?(): void;
  onModuleDestroy?(): void;
}
