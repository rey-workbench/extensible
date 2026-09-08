import { AppModule } from "@/app.module";
import { NestFactory } from "@/core/index";
import { PopupShell } from "@/popup/popup-shell";

async function bootstrap(): Promise<PopupShell> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    context: "popup",
  });
  const shell = new PopupShell(app);
  shell.init();
  return shell;
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((err) => console.error("[NestJS AIO] Popup bootstrap failed:", err));
});
