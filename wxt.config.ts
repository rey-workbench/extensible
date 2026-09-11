import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

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
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      target: "es2022",
      cssMinify: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1000,
    },
    esbuild: {
      drop: ["debugger"],
      pure: ["console.log", "console.debug"],
      legalComments: "none",
    },
  }),
  manifest: {
    name: "Extensible - Modular Extension Suite",
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
      default_title: "Extensible",
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
  },
});
