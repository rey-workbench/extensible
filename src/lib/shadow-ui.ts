type UiHandledEvent = Event & { __usUiHandled?: boolean };

interface HostRegistry {
  hosts: Set<HTMLElement>;
  onClick: (event: Event) => void;
  onKey: (event: Event) => void;
}

const registries = new WeakMap<Document, HostRegistry>();
const hostDocuments = new WeakMap<HTMLElement, Document>();

function composedPathOf(event: Event): EventTarget[] {
  return event.composedPath ? event.composedPath() : [];
}

function hostInPath(registry: HostRegistry, path: EventTarget[]): HTMLElement | null {
  for (const host of registry.hosts) {
    if (path.includes(host)) return host;
  }
  return null;
}

function registryFor(doc: Document): HostRegistry {
  const existing = registries.get(doc);
  if (existing) return existing;

  const registry: HostRegistry = {
    hosts: new Set<HTMLElement>(),
    onClick: (event) => {
      const target = event.target as Element | null;
      if (!target || !hostInPath(registry, composedPathOf(event))) return;
      const marked = event as UiHandledEvent;
      setTimeout(() => {
        if (marked.__usUiHandled || !target.isConnected) return;
        target.dispatchEvent(
          new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }),
        );
      }, 0);
    },
    onKey: (event) => {
      if (hostInPath(registry, composedPathOf(event))) event.stopPropagation();
    },
  };

  const view = doc.defaultView;
  view?.addEventListener("click", registry.onClick, true);
  view?.addEventListener("keydown", registry.onKey, true);
  view?.addEventListener("keyup", registry.onKey, true);
  view?.addEventListener("keypress", registry.onKey, true);
  registries.set(doc, registry);
  return registry;
}

function registerHost(host: HTMLElement): () => void {
  const doc = host.ownerDocument ?? document;
  const registry = registryFor(doc);
  registry.hosts.add(host);
  hostDocuments.set(host, doc);

  return () => {
    registry.hosts.delete(host);
    hostDocuments.delete(host);
    if (registry.hosts.size > 0) return;
    const view = doc.defaultView;
    view?.removeEventListener("click", registry.onClick, true);
    view?.removeEventListener("keydown", registry.onKey, true);
    view?.removeEventListener("keyup", registry.onKey, true);
    view?.removeEventListener("keypress", registry.onKey, true);
    registries.delete(doc);
  };
}

const sharedSheets = new WeakMap<Document, Map<string, CSSStyleSheet>>();

export function installSharedStyles(shadow: ShadowRoot, css: string): void {
  if (!css) return;
  const doc = shadow.ownerDocument ?? document;

  const supportsSheets =
    typeof CSSStyleSheet !== "undefined" &&
    typeof (CSSStyleSheet.prototype as CSSStyleSheet).replaceSync === "function" &&
    "adoptedStyleSheets" in shadow;

  if (supportsSheets) {
    let perDocument = sharedSheets.get(doc);
    if (!perDocument) {
      perDocument = new Map<string, CSSStyleSheet>();
      sharedSheets.set(doc, perDocument);
    }
    let sheet = perDocument.get(css);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      perDocument.set(css, sheet);
    }
    if (!shadow.adoptedStyleSheets.includes(sheet)) {
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
    }
    return;
  }

  const style = doc.createElement("style");
  style.textContent = css;
  shadow.appendChild(style);
}

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
  return registerHost(host);
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
  installSharedStyles(shadow, extraCss);
  return { host, shadow };
}

export function shieldKeysFromHost(host: HTMLElement): () => void {
  return registerHost(host);
}
