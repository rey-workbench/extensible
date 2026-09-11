import { mount } from "svelte";
import {
  createShadowHost,
  markUiClicks,
  rescueClicksIn,
  shieldKeysFromHost,
} from "@/lib/shadow-ui";
import SideNotch from "./components/SideNotch.svelte";

export function setupContent(): void {
  const ui = createShadowHost("aio-side-notch-host");
  if (!ui) return;
  const { host, shadow } = ui;

  markUiClicks(shadow);
  rescueClicksIn(host);
  shieldKeysFromHost(host);

  mount(SideNotch, { target: shadow, props: { shadowRoot: shadow } });
}
