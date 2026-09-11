import { defineFeature } from "@/lib/feature-registry";
import { setupUserScriptsBackground } from "./background";
import UserScripts from "./components/UserScripts.svelte";

defineFeature({
  id: "user-scripts",
  name: "User Scripts",
  description: "Tampermonkey-like userscript engine (GM_* APIs, auto-inject)",
  icon: "puzzle",
  color: "#C48C1E",
  background: setupUserScriptsBackground,
  content: async () => {
    const { setupUserScriptsContent } = await import("./content");
    return setupUserScriptsContent();
  },
  popup: UserScripts,
});
