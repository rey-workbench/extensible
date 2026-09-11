import { BORDER, DANGER, DANGER_DARK, FONT_STACK, INK, SURFACE } from "@/lib/design-tokens";

export function showToast(
  mountInto: HTMLElement | ShadowRoot,
  message: string,
  opts: { isError?: boolean; anchor?: HTMLElement; durationMs?: number } = {}
): void {
  const { isError = false, anchor, durationMs = 2000 } = opts;

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.setAttribute("role", "status");
  Object.assign(toast.style, {
    position: "fixed",
    zIndex: "2147483647",
    padding: "4px 14px",
    fontFamily: FONT_STACK,
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    borderRadius: "6px",
    border: `1.5px solid ${isError ? DANGER_DARK : BORDER}`,
    background: isError ? DANGER : SURFACE,
    color: isError ? "#ffffff" : INK,
    boxShadow: `3px 3px 0 ${INK}`,
    transition: "transform 0.2s ease, opacity 0.2s ease",
    opacity: "0",
    transform: "translate(-50%, 4px)",
  } satisfies Partial<CSSStyleDeclaration>);

  if (anchor) {
    const r = anchor.getBoundingClientRect();
    toast.style.bottom = `${Math.max(12, window.innerHeight - r.top + 8)}px`;
    toast.style.left = `${r.left + r.width / 2}px`;
  } else {
    toast.style.bottom = "12px";
    toast.style.left = "50%";
  }

  mountInto.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, 4px)";
    setTimeout(() => toast.remove(), 250);
  }, durationMs);
}
