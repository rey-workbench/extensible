import { AppModule } from "@/app.module";
import { SideNotchView } from "@/content/side-notch.view";
import { NestFactory } from "@/core/index";

declare global {
  interface Window {
    __AIO_CONTENT_BOOTSTRAPPED__?: boolean;
  }
}

async function bootstrap() {
  if (typeof window !== "undefined") {
    if (window.__AIO_CONTENT_BOOTSTRAPPED__) return;
    window.__AIO_CONTENT_BOOTSTRAPPED__ = true;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    context: ["content", "popup"],
  });

  // Always display the right-side notch on web pages
  const sideNotch = new SideNotchView(app);
  sideNotch.init();

  return app;
}

bootstrap().catch((err) => console.error("[NestJS AIO] Content script bootstrap failed:", err));
