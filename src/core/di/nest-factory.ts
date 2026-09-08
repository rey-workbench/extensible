import { Container } from "@/core/di/container";
import type {
  ClassConstructor,
  ContextOptions,
  ModuleDefinition,
  RegisteredModule,
} from "@/core/types/index";

/**
 * NestJS-style Application Context for Chrome Extensions.
 */
export class NestApplicationContext {
  constructor(
    public readonly container: Container,
    public readonly options: ContextOptions = {}
  ) {}

  get<T>(token: any): T {
    return this.container.get<T>(token);
  }

  getModules(): RegisteredModule[] {
    return this.container.getModules();
  }

  getController<T>(ControllerClass: ClassConstructor<T>): T | null {
    return this.container.getController(ControllerClass);
  }

  async init(): Promise<this> {
    await this.container.init();
    return this;
  }

  async close(): Promise<void> {
    await this.container.destroy();
  }
}

export class NestFactory {
  static async createApplicationContext(
    rootModule: ModuleDefinition,
    options: ContextOptions = {}
  ): Promise<NestApplicationContext> {
    const container = new Container();
    await container.registerModule(rootModule, options);
    const appContext = new NestApplicationContext(container, options);
    await appContext.init();
    return appContext;
  }
}
