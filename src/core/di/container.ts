import type {
  ClassConstructor,
  ContextOptions,
  ExecutionContext,
  ModuleDefinition,
  Provider,
  RegisteredModule,
  TokenKey,
} from "@/core/types/index";

interface ProviderBinding {
  readonly token: TokenKey;
  readonly providerClass: unknown;
  readonly useValue?: unknown;
}

interface LifecycleHookable {
  onModuleInit?: () => unknown;
  onModuleDestroy?: () => unknown;
}

function tokensMatch(a: TokenKey, b: TokenKey): boolean {
  if (a === b) return true;
  // SAFETY: only class constructors carry a `name`; strings/symbols fall back to identity
  const aName = (a as { name?: string }).name;
  const bName = (b as { name?: string }).name;
  return aName !== undefined && aName !== "" && aName === bName;
}

/**
 * Lightweight IoC Dependency Injection Container modeled after NestJS.
 * Supports two-phase binding, lazy on-demand resolution, and circular dependency detection.
 */
export class Container {
  private readonly _providers = new Map<TokenKey, unknown>();
  private readonly _definitions = new Map<TokenKey, ProviderBinding>();
  private readonly _modules = new Map<TokenKey, RegisteredModule>();
  private readonly _resolvingStack = new Set<TokenKey>();
  private _contextOptions: ContextOptions = {};

  async registerModule(
    moduleDef: ModuleDefinition,
    contextOptions: ContextOptions = {}
  ): Promise<RegisteredModule> {
    this._contextOptions = contextOptions;
    const moduleClass: TokenKey = moduleDef.module ?? moduleDef.id ?? "module";
    if (this._modules.has(moduleClass)) {
      return this._modules.get(moduleClass)!;
    }

    const imports = moduleDef.imports || [];
    const providers = moduleDef.providers || [];
    const controllers = moduleDef.controllers || [];
    const exports = moduleDef.exports || [];

    // Phase 1: Recursively register imports
    for (const imported of imports) {
      await this.registerModule(imported, contextOptions);
    }

    // Phase 2: Register provider definitions
    for (const provider of providers) {
      this._bindProvider(provider);
    }

    // Phase 3: Eagerly resolve provider singletons (order-independent)
    for (const provider of providers) {
      const token = typeof provider === "function" ? provider : provider.provide;
      this.get(token);
    }

    // Phase 4: Instantiate context-matching controllers
    const currentContext = contextOptions.context || "all";
    const activeControllers: object[] = [];

    for (const controller of controllers) {
      if (this._isContextMatch(controller.contextType, currentContext)) {
        const instance = await this._instantiate(controller, contextOptions);
        activeControllers.push(instance as object);
      }
    }

    const registered: RegisteredModule = {
      id:
        moduleDef.id ||
        (typeof moduleClass === "string" ? moduleClass : (moduleClass as { name?: string }).name) ||
        "module",
      name: moduleDef.name || moduleDef.id || "Module",
      description: moduleDef.description || "",
      icon: moduleDef.icon || "",
      moduleDef,
      moduleClass,
      controllers: activeControllers,
      exports,
    };

    this._modules.set(moduleClass, registered);
    return registered;
  }

  private _bindProvider(provider: Provider): void {
    if (typeof provider === "function") {
      this._definitions.set(provider, { token: provider, providerClass: provider });
      return;
    }

    const token = provider.provide;
    if ("useValue" in provider) {
      const useValue = provider.useValue;
      this._definitions.set(token, { token, providerClass: provider.provide, useValue });
      if (useValue !== undefined) {
        this._providers.set(token, useValue);
      }
      return;
    }

    this._definitions.set(token, { token, providerClass: provider.useClass });
  }

  private _isContextMatch(
    target: ExecutionContext | undefined,
    current: ExecutionContext | readonly ExecutionContext[]
  ): boolean {
    const targetCtx = target || "all";
    if (Array.isArray(current)) {
      return targetCtx === "all" || current.includes(targetCtx);
    }
    return current === "all" || targetCtx === "all" || targetCtx === current;
  }

  get<T>(token: TokenKey): T {
    // 1. Check existing instance
    if (this._providers.has(token)) {
      return this._providers.get(token) as T;
    }
    for (const [key, instance] of this._providers.entries()) {
      if (tokensMatch(key, token)) {
        return instance as T;
      }
    }

    // 2. Resolve on-demand from registered definitions
    const def = this._findDefinition(token);
    if (def) {
      return this._resolveDefinition(def) as T;
    }

    throw new Error(
      `[DI Container] Provider '${(token as { name?: string }).name ?? String(token)}' not found`
    );
  }

  private _findDefinition(token: TokenKey): ProviderBinding | undefined {
    if (this._definitions.has(token)) {
      return this._definitions.get(token);
    }
    for (const [key, def] of this._definitions.entries()) {
      if (tokensMatch(key, token)) {
        return def;
      }
    }
    return undefined;
  }

  private _resolveDefinition(def: ProviderBinding): unknown {
    if (this._resolvingStack.has(def.token)) {
      const cycle = [...this._resolvingStack, def.token]
        .map((t) => (typeof t === "function" ? t.name : String(t)))
        .join(" -> ");
      throw new Error(`[DI Container] Circular dependency detected: ${cycle}`);
    }

    if (def.useValue !== undefined) {
      this._providers.set(def.token, def.useValue);
      return def.useValue;
    }

    this._resolvingStack.add(def.token);
    try {
      const instance = this._instantiate(def.providerClass, this._contextOptions);
      this._providers.set(def.token, instance);
      return instance;
    } finally {
      this._resolvingStack.delete(def.token);
    }
  }

  getModules(): RegisteredModule[] {
    return Array.from(this._modules.values());
  }

  getController<T>(ControllerClass: ClassConstructor<T>): T | null {
    for (const [, module] of this._modules) {
      for (const ctrl of module.controllers) {
        if (ctrl instanceof ControllerClass || ctrl.constructor.name === ControllerClass.name) {
          return ctrl as T;
        }
      }
    }
    return null;
  }

  async init(): Promise<void> {
    for (const [, instance] of this._providers) {
      const hookable = instance as LifecycleHookable | null | undefined;
      if (typeof hookable?.onModuleInit === "function") {
        await hookable.onModuleInit();
      }
    }
    for (const [, module] of this._modules) {
      for (const ctrl of module.controllers) {
        const hookable = ctrl as LifecycleHookable | null | undefined;
        if (typeof hookable?.onModuleInit === "function") {
          await hookable.onModuleInit();
        }
      }
    }
  }

  async destroy(): Promise<void> {
    for (const [, module] of this._modules) {
      for (const ctrl of module.controllers) {
        const hookable = ctrl as LifecycleHookable | null | undefined;
        if (typeof hookable?.onModuleDestroy === "function") {
          await hookable.onModuleDestroy();
        }
      }
    }
    for (const [, instance] of this._providers) {
      const hookable = instance as LifecycleHookable | null | undefined;
      if (typeof hookable?.onModuleDestroy === "function") {
        await hookable.onModuleDestroy();
      }
    }
    this._providers.clear();
    this._definitions.clear();
    this._modules.clear();
    this._resolvingStack.clear();
  }

  private _instantiate(TargetClass: unknown, contextOptions: ContextOptions): unknown {
    if (typeof TargetClass !== "function") {
      return TargetClass;
    }

    const ctor = TargetClass as ClassConstructor;
    const injectTokens = ctor.inject || [];
    const dependencies: unknown[] = [];

    for (const depToken of injectTokens) {
      if (depToken === "CONTEXT_OPTIONS") {
        dependencies.push(contextOptions);
      } else {
        dependencies.push(this.get(depToken));
      }
    }

    // SAFETY: constructor shape is validated by ClassConstructor contract
    const Instantiable = TargetClass as new (...args: unknown[]) => object;
    return new Instantiable(...dependencies);
  }
}
