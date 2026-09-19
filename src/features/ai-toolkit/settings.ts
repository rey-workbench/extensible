import type { FeatureSettingsSchema } from "@/lib/feature-registry";
import { CAVEMAN_HINTS, CAVEMAN_LEVELS } from "./constants/ai-toolkit.constants";
import { getCavemanSettings, updateCavemanSettings } from "./services/ai-toolkit.service";
import type { CavemanSettings } from "./types/ai-toolkit.types";

export const aiToolkitSettingsSchema: FeatureSettingsSchema = {
  fields: [
    {
      kind: "toggle",
      key: "enabled",
      label: "Terse Response Mode",
      hint: "Rewrite prompts so answers drop filler, pleasantries and hedging. Keeps 100% of the substance.",
    },
    {
      kind: "select",
      key: "level",
      label: "Intensity",
      options: CAVEMAN_LEVELS.map((level) => ({
        value: level,
        label: level.toUpperCase(),
        hint: CAVEMAN_HINTS[level],
      })),
    },
  ],
  read: async () => ({ ...(await getCavemanSettings()) }),
  write: async (patch) => ({ ...(await updateCavemanSettings(patch as Partial<CavemanSettings>)) }),
};
