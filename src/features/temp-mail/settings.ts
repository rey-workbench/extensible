import type { FeatureSettingsSchema } from "@/lib/feature-registry";
import { getTempMailSettings, updateTempMailSettings } from "./services/temp-mail.service";
import type { TempMailSettings } from "./types/temp-mail.types";

export const tempMailSettingsSchema: FeatureSettingsSchema = {
  fields: [
    {
      kind: "toggle",
      key: "showFloatingButton",
      label: "Autofill badge",
      hint: "Show a quick-fill button on every email field, and open temp mail from any page.",
    },
  ],
  read: async () => ({ ...(await getTempMailSettings()) }),
  write: async (patch) => ({
    ...(await updateTempMailSettings(patch as Partial<TempMailSettings>)),
  }),
};
