import { defineFeature } from "@/lib/feature-registry";
import { setupBackground } from "./background";
import UserScripts from "./components/UserScripts.svelte";

defineFeature({
  id: "user-scripts",
  name: "User Scripts",
  description: "Tampermonkey-like userscript engine (GM_* APIs, auto-inject)",
  icon: "puzzle",
  color: "#C48C1E",
  background: setupBackground,
  content: () => import("./content").then((m) => m.setupContent()),
  popup: UserScripts,
});
