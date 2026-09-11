import { defineFeature } from "@/lib/feature-registry";
import { setupTempMailBackground } from "./background";
import TempMail from "./components/TempMail.svelte";

defineFeature({
  id: "temp-mail",
  name: "Temp Mail",
  description: "Disposable email with live inbox & OTP reader",
  icon: "mail",
  color: "#D63230",
  background: setupTempMailBackground,
  content: async () => {
    const { setupTempMailContent } = await import("./content");
    return setupTempMailContent();
  },
  popup: TempMail,
});
