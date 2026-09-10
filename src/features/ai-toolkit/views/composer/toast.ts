import { computeToastPlacement } from "./positioning";

/** Shows a transient toast anchored near the toolbar container. */
export function showComposerToast(anchor: HTMLElement, message: string, isError = false): void {
  const rect = anchor.getBoundingClientRect();
  const toast = document.createElement("div");
  toast.className =
    "aio-composer-toast fixed whitespace-nowrap rounded-md border-[1.5px] border-solid px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-[3px_3px_0_#1A1A1A] transition-all pointer-events-none";
  toast.style.fontFamily =
    "'Space Grotesk', system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  toast.style.background = isError ? "#D63230" : "#FFFDF7";
  toast.style.borderColor = isError ? "#A82624" : "#2B2B2B";
  toast.style.color = isError ? "#ffffff" : "#1A1A1A";
  toast.textContent = message;

  toast.style.zIndex = "2147483647";
  const { bottom, left } = computeToastPlacement(rect);
  toast.style.bottom = `${bottom}px`;
  toast.style.left = `${left}px`;
  toast.style.transform = "translateX(-50%) translateY(4px)";

  const rootNode = anchor.getRootNode();
  const mountTarget = rootNode instanceof ShadowRoot ? rootNode : document.body;
  mountTarget.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(4px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}
