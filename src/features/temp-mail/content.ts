import { setNativeValue } from "@/lib/browser";
import { onMessage } from "@/lib/messaging";
import { TEMPMAIL_ACTIONS } from "./constants/temp-mail.constants";
import { setupBadges } from "./services/badge-manager.service";
import { isEmailField } from "./utils/temp-mail.utils";

export async function setupContent(): Promise<void> {
  onMessage<{ email?: string } | null, boolean>(TEMPMAIL_ACTIONS.AUTOFILL_EMAIL, (payload) => {
    const email = payload?.email;
    if (!email) return false;

    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLInputElement && isEmailField(activeEl)) {
      setNativeValue(activeEl, email);
      return true;
    }
    for (const input of document.querySelectorAll<HTMLInputElement>("input")) {
      if (isEmailField(input)) {
        setNativeValue(input, email);
        return true;
      }
    }
    return false;
  });

  await setupBadges();
}
