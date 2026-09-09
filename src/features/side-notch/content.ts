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
  mount(SideNotch, { target: shadow, props: { shadowRoot: shadow } });
}
