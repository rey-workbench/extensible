import { mount } from "svelte";
import SideNotch from "./components/SideNotch.svelte";

/**
 * Side Notch content setup: floating notch + slide-out drawer.
 *
 * Click rescue: many host pages (Google, etc.) attach window-level CAPTURE
 * click handlers that call stopPropagation(). Because those fire before the
 * event can descend into our shadow root, every button inside the drawer and
 * quick panel silently stops working (the × / toggle / rows all die). We mark
 * clicks that genuinely reach our tree and, in the window capture phase,
 * re-dispatch any click that targeted our host but never arrived.
 */
export function setupSideNotchContent(): void {
  if (document.getElementById("aio-side-notch-host")) return;

  const host = document.createElement("div");
  host.id = "aio-side-notch-host";
  host.style.all = "initial";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Mark clicks that actually descended into our shadow tree.
  shadow.addEventListener(
    "click",
    (e) => {
      (e as Event & { __usUiHandled?: boolean }).__usUiHandled = true;
    },
    true
  );

  // Rescue clicks the page swallowed before they reached us. Runs from the
  // window capture phase: same node as the page's handler, so it still fires
  // after a plain stopPropagation() (stopImmediatePropagation would be the
  // only thing that can beat it — rare on real sites).
  const rescueClick = (e: Event) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.includes(host)) return;
    const ev = e as Event & { __usUiHandled?: boolean };
    // Defer: the original event needs time to finish (or fail) its descent.
    setTimeout(() => {
      if (ev.__usUiHandled) return; // already handled inside our UI
      const target = e.target as Element | null;
      if (!target || !path.includes(target)) return;
      target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, composed: true, cancelable: true })
      );
    }, 0);
  };
  window.addEventListener("click", rescueClick, true);

  // Prevent host webpage shortcuts and event handlers from hijacking or blocking typing inside extension UI.
  const stopHostInterception = (e: Event) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host)) {
      e.stopPropagation();
    }
  };
  window.addEventListener("keydown", stopHostInterception, true);
  window.addEventListener("keyup", stopHostInterception, true);
  window.addEventListener("keypress", stopHostInterception, true);

  mount(SideNotch, { target: shadow, props: { shadowRoot: shadow } });
}
