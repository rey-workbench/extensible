import { defineFeature } from "@/lib/feature-registry";
import { setupBackground } from "./background";
import Youtube from "./components/Youtube.svelte";

defineFeature({
  id: "youtube",
  name: "YouTube",
  description: "Play a video in the hub while you keep working",
  icon: "play",
  color: "#C2185B",
  background: setupBackground,
  popup: Youtube,
});
