/**
 * Auto-update service: periodically fetches @updateURL/@downloadURL sources,
 * compares @version (semver), saves newer code and notifies the user.
 */
import { showNotification } from "@/lib/browser";
import { parseUserScriptHeader } from "../utils/header-parser.utils";
import { UserScriptsService } from "./user-scripts.service";

export class UpdateService {
  static async checkAll(): Promise<void> {
    const scripts = await UserScriptsService.list();
    for (const script of scripts) {
      const updateUrl = script.meta.updateURL || script.meta.downloadURL;
      if (!updateUrl) continue;
      try {
        const res = await fetch(updateUrl, { credentials: "omit" });
        if (!res.ok) continue;
        const code = await res.text();
        const meta = parseUserScriptHeader(code);
        if (UpdateService.compareVersions(meta.version, script.meta.version) > 0) {
          const updated = { ...script, code, updatedAt: Date.now() };
          await UserScriptsService.save(updated);
          showNotification({
            title: "Userscript updated",
            message: `${script.meta.name} → v${meta.version}`,
          });
        }
      } catch {
        // Skip unreachable update hosts silently.
      }
    }
  }

  private static compareVersions(a: string, b: string): number {
    const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }
}
