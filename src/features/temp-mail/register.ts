import { defineFeature } from "@/lib/feature-registry";
import { setupBackground } from "./background";
import TempMail from "./components/TempMail.svelte";
import { tempMailSettingsSchema } from "./settings";

defineFeature({
  id: "temp-mail",
  name: "Temp Mail",
  description: "Disposable email with live inbox & OTP reader",
  icon: "mail",
  color: "#D63230",
  background: setupBackground,
  content: () => import("./content").then((m) => m.setupContent()),
  popup: TempMail,
  settings: tempMailSettingsSchema,
});
