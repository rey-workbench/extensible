type UiHandledEvent = Event & { __usUiHandled?: boolean };

export function markUiClicks(shadow: ShadowRoot): void {
  shadow.addEventListener(
    "click",
    (e) => {
      (e as UiHandledEvent).__usUiHandled = true;
    },
    true,
  );
}

export function rescueClicksIn(host: HTMLElement): () => void {
  const rescueClick = (e: Event) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.includes(host)) return;
    const ev = e as UiHandledEvent;
    setTimeout(() => {
      if (ev.__usUiHandled) return;
      const target = e.target as Element | null;
      if (!target || !path.includes(target)) return;
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }),
      );
    }, 0);
  };
  window.addEventListener("click", rescueClick, true);
  return () => window.removeEventListener("click", rescueClick, true);
}

export function createShadowHost(
  id: string,
  extraCss = "",
): { host: HTMLElement; shadow: ShadowRoot } | null {
  if (document.getElementById(id)) return null;
  const host = document.createElement("div");
  host.id = id;
  host.style.all = "initial";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  if (extraCss) {
    const style = document.createElement("style");
    style.textContent = extraCss;
    shadow.appendChild(style);
  }
  return { host, shadow };
}

export function shieldKeysFromHost(host: HTMLElement): () => void {
  const stop = (e: Event) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host)) e.stopPropagation();
  };
  window.addEventListener("keydown", stop, true);
  window.addEventListener("keyup", stop, true);
  window.addEventListener("keypress", stop, true);
  return () => {
    window.removeEventListener("keydown", stop, true);
    window.removeEventListener("keyup", stop, true);
    window.removeEventListener("keypress", stop, true);
  };
}
