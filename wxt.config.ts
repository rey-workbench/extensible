import tailwindcss from "@tailwindcss/vite";
import { loadEnv, type UserConfig } from "vite";
import { defineConfig } from "wxt";

const esbuildOptions: UserConfig["esbuild"] = {
  pure: ["console.log", "console.debug", "console.info"],
  legalComments: "none",
};

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  targetBrowsers: ["chrome", "firefox", "edge"],
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  zip: {
    artifactTemplate: "{{name}}-{{version}}-{{browser}}.zip",
    sourcesTemplate: "{{name}}-{{version}}-sources.zip",
  },
  vite: (env) => ({
    plugins: [tailwindcss()],
    build: {
      target: "es2022",
      cssMinify: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === "SOURCEMAP_BROKEN") return;
          warn(warning);
        },
      },
    },
    esbuild: env.mode === "production" ? esbuildOptions : undefined,
  }),
  manifest: (env) => {
    const loadedEnv = loadEnv(env.mode, process.cwd(), "");
    const isDev = env.mode === "development";
    const defaultName = isDev
      ? "Extensible - Modular Extension Suite (DEV)"
      : "Extensible - Modular Extension Suite";
    const name = loadedEnv.EXTENSION_NAME || loadedEnv.VITE_APP_TITLE || defaultName;

    return {
      minimum_chrome_version: "120",
      name,
      description:
        "Extensible modular productivity extension with temporary email generation, instant input autofill, and live inbox OTP reader.",
      permissions: [
        "storage",
        "unlimitedStorage",
        "alarms",
        "activeTab",
        "contextMenus",
        "clipboardWrite",
        "scripting",
        "tabs",
        "notifications",
        "downloads",
        "userScripts",
      ],
      host_permissions: ["https://api.tempmail.ing/*", "http://127.0.0.1/*", "<all_urls>"],
      browser_specific_settings: {
        gecko: {
          id: "extensible@extension.local",
          strict_min_version: "109.0",
        },
      },
      icons: {
        "16": "icon/icon-16.png",
        "32": "icon/icon-32.png",
        "48": "icon/icon-48.png",
        "128": "icon/icon-128.png",
      },
      action: {
        default_title: isDev ? "Extensible (DEV)" : "Extensible",
        default_popup: "popup.html",
        default_icon: {
          "16": "icon/icon-16.png",
          "32": "icon/icon-32.png",
          "48": "icon/icon-48.png",
          "128": "icon/icon-128.png",
        },
      },
      web_accessible_resources: [
        {
          resources: ["icon/*"],
          matches: ["<all_urls>"],
        },
      ],
    };
  },
});
