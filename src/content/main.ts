import { AppModule } from '@/app.module';
import { NestFactory } from '@/core/index';
import { SideNotchView } from '@/content/side-notch.view';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    context: ['content', 'popup']
  });

  // Always display the right-side notch on web pages
  const sideNotch = new SideNotchView(app);
  sideNotch.init();

  return app;
}

bootstrap().catch((err) => console.error('[NestJS AIO] Content script bootstrap failed:', err));
