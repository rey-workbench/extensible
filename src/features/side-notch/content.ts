import { mount } from "svelte";
import SideNotch from "./components/SideNotch.svelte";

/** Side Notch content setup: floating notch + slide-out drawer. */
export function setupSideNotchContent(): void {
  if (document.getElementById("aio-side-notch-host")) return;

  const host = document.createElement("div");
  host.id = "aio-side-notch-host";
  host.style.all = "initial";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

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
