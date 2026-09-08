/**
 * Core runtime execution context and DI constructor contracts.
 */
export type ExecutionContext = "all" | "background" | "content" | "popup";

export interface ContextOptions {
  context?: ExecutionContext | readonly ExecutionContext[];
  mount?: HTMLElement | null;
}

export interface ClassConstructor<T = unknown> {
  new (...args: any[]): T;
  inject?: any[];
  contextType?: ExecutionContext;
}
