import type { ClassConstructor, ContextOptions, ExecutionContext, ModuleDefinition, RegisteredModule } from '@/core/types/index';

interface ProviderBinding {
  readonly token: any;
  readonly providerClass: any;
  readonly useValue?: any;
}

/**
 * Lightweight IoC Dependency Injection Container modeled after NestJS.
 * Supports two-phase binding, lazy on-demand resolution, and circular dependency detection.
 */
export class Container {
  private readonly _providers = new Map<any, any>();
  private readonly _definitions = new Map<any, ProviderBinding>();
  private readonly _modules = new Map<any, RegisteredModule>();
  private readonly _resolvingStack = new Set<any>();
  private _contextOptions: ContextOptions = {};

  async registerModule(moduleDef: ModuleDefinition, contextOptions: ContextOptions = {}): Promise<RegisteredModule> {
    this._contextOptions = contextOptions;
    const moduleClass = moduleDef.module || moduleDef;
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
      const token = (typeof provider === 'object' && provider !== null && 'provide' in provider)
        ? provider.provide
        : provider;
      this.get(token);
    }

    // Phase 4: Instantiate context-matching controllers
    const currentContext = contextOptions.context || 'all';
    const activeControllers: any[] = [];

    for (const controller of controllers) {
      if (this._isContextMatch(controller.contextType, currentContext)) {
        const instance = await this._instantiate(controller, contextOptions);
        activeControllers.push(instance);
      }
    }

    const registered: RegisteredModule = {
      id: moduleDef.id || (typeof moduleClass === 'function' ? moduleClass.name : 'module'),
      name: moduleDef.name || moduleDef.id || 'Module',
      description: moduleDef.description || '',
      icon: moduleDef.icon || '',
      moduleDef,
      moduleClass,
      controllers: activeControllers,
      exports
    };

    this._modules.set(moduleClass, registered);
    return registered;
  }

  private _bindProvider(provider: any): void {
    let token = provider;
    let providerClass = provider;
    let useValue: any;

    if (typeof provider === 'object' && provider !== null && 'provide' in provider) {
      token = provider.provide;
      useValue = provider.useValue;
      providerClass = provider.useClass || provider.provide;
    }

    this._definitions.set(token, { token, providerClass, useValue });
    if (useValue !== undefined) {
      this._providers.set(token, useValue);
    }
  }

  private _isContextMatch(
    target: ExecutionContext | undefined,
    current: ExecutionContext | readonly ExecutionContext[]
  ): boolean {
    const targetCtx = target || 'all';
    if (Array.isArray(current)) {
      return targetCtx === 'all' || current.includes(targetCtx);
    }
    return current === 'all' || targetCtx === 'all' || targetCtx === current;
  }

  get<T>(token: any): T {
    // 1. Check existing instance
    if (this._providers.has(token)) {
      return this._providers.get(token) as T;
    }
    for (const [key, instance] of this._providers.entries()) {
      if (key?.name === token?.name || key === token) {
        return instance as T;
      }
    }

    // 2. Resolve on-demand from registered definitions
    const def = this._findDefinition(token);
    if (def) {
      return this._resolveDefinition(def) as T;
    }

    throw new Error(`[DI Container] Provider '${token?.name || token}' not found`);
  }

  private _findDefinition(token: any): ProviderBinding | undefined {
    if (this._definitions.has(token)) {
      return this._definitions.get(token);
    }
    for (const [key, def] of this._definitions.entries()) {
      if (key?.name === token?.name || key === token) {
        return def;
      }
    }
    return undefined;
  }

  private _resolveDefinition(def: ProviderBinding): any {
    if (this._resolvingStack.has(def.token)) {
      const cycle = [...this._resolvingStack, def.token].map((t) => t?.name || String(t)).join(' -> ');
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
      if (typeof instance?.onModuleInit === 'function') {
        await instance.onModuleInit();
      }
    }
    for (const [, module] of this._modules) {
      for (const ctrl of module.controllers) {
        if (typeof ctrl?.onModuleInit === 'function') {
          await ctrl.onModuleInit();
        }
      }
    }
  }

  async destroy(): Promise<void> {
    for (const [, module] of this._modules) {
      for (const ctrl of module.controllers) {
        if (typeof ctrl?.onModuleDestroy === 'function') {
          await ctrl.onModuleDestroy();
        }
      }
    }
    for (const [, instance] of this._providers) {
      if (typeof instance?.onModuleDestroy === 'function') {
        await instance.onModuleDestroy();
      }
    }
    this._providers.clear();
    this._definitions.clear();
    this._modules.clear();
    this._resolvingStack.clear();
  }

  private _instantiate(TargetClass: any, contextOptions: ContextOptions): any {
    if (typeof TargetClass !== 'function') {
      return TargetClass;
    }

    const injectTokens = TargetClass.inject || [];
    const dependencies: any[] = [];

    for (const depToken of injectTokens) {
      if (depToken === 'CONTEXT_OPTIONS') {
        dependencies.push(contextOptions);
      } else {
        dependencies.push(this.get(depToken));
      }
    }

    return new TargetClass(...dependencies);
  }
}
