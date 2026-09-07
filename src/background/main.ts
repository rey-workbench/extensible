import { AppModule } from '@/app.module';
import { NestFactory } from '@/core/index';

async function bootstrap() {
  console.log('[NestJS AIO] Bootstrapping Background Service Worker...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    context: 'background'
  });
  console.log('[NestJS AIO] Background Service Worker ready.');
  return app;
}

bootstrap().catch((err) => console.error('[NestJS AIO] Background bootstrap failed:', err));
