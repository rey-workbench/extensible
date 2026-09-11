import { defineFeature } from "@/lib/feature-registry";
import { setupTempMailBackground } from "./background";
import TempMail from "./components/TempMail.svelte";
import { setupTempMailContent } from "./content";

defineFeature({
  id: "temp-mail",
  name: "Temp Mail",
  description: "Disposable email with live inbox & OTP reader",
  icon: "mail",
  color: "#D63230",
  background: setupTempMailBackground,
  content: setupTempMailContent,
  popup: TempMail,
});
