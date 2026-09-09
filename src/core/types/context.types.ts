/**
 * Core runtime execution context and DI constructor contracts.
 */
export type ExecutionContext = "all" | "background" | "content" | "popup";

export interface ContextOptions {
  context?: ExecutionContext | readonly ExecutionContext[];
  mount?: HTMLElement | null;
}

/** Class constructor usable as a DI token. */
type Token = abstract new (...args: never[]) => unknown;

/** Any value usable as a DI token: a class constructor or a string/symbol key. */
export type TokenKey = Token | string | symbol;

export interface ClassConstructor<T = unknown> {
  new (...args: never[]): T;
  inject?: readonly TokenKey[];
  contextType?: ExecutionContext;
}
