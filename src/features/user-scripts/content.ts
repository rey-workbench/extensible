import { sendMessage } from "@/lib/messaging";
import { USER_SCRIPTS_ACTIONS } from "./constants/user-scripts.constants";
import { isUserScriptUrl } from "./utils/capture.utils";
import { setupGmRelay } from "./utils/relay";

function setupScriptCapture(): void {
  document.addEventListener(
    "click",
    (e) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!target) return;
      const href = target.href;
      if (!href) return;

      if (isUserScriptUrl(href)) {
        e.preventDefault();
        e.stopPropagation();

        void sendMessage(USER_SCRIPTS_ACTIONS.CAPTURE_URL, { url: href });
      }
    },
    true,
  );
}

export function setupContent(): void {
  setupGmRelay();
  setupScriptCapture();
}
