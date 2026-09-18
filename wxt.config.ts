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
        // Kept deliberately: userscript sources plus their GM values would
        // otherwise share the ~10 MB local quota, and a quota error mid-save is
        // silent data loss. See docs/data.md for the stored-data inventory.
        "unlimitedStorage",
        "alarms",
        "contextMenus",
        "clipboardWrite",
        "scripting",
        "tabs",
        "notifications",
        "downloads",
        "userScripts",
      ],
      // `<all_urls>` already covers the mail API and localhost dev server, so
      // they are not listed separately. `activeTab` was dropped as redundant.
      host_permissions: ["<all_urls>"],
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
      commands: {
        "toggle-dock": {
          suggested_key: { default: "Alt+Shift+E" },
          description: "Open the Extensible quick dock",
        },
        "copy-temp-email": {
          suggested_key: { default: "Alt+Shift+M" },
          description: "Copy a temporary email address",
        },
        "export-chat": {
          suggested_key: { default: "Alt+Shift+X" },
          description: "Export the current AI chat",
        },
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
