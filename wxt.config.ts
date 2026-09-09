import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "Extensible - Modular Extension Suite",
    description:
      "Extensible modular productivity extension with temporary email generation, instant input autofill, and live inbox OTP reader.",
    permissions: ["storage", "alarms", "activeTab", "contextMenus", "clipboardWrite", "scripting", "notifications", "downloads"],
    host_permissions: ["https://api.tempmail.ing/*", "http://127.0.0.1/*"],
  },
});
