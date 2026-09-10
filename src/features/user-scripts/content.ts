/**
 * User-scripts content-side setup: installs the ISOLATED-world GM RPC relay.
 * Runs on every page via the shared <all_urls> content script; the relay is
 * passive until a script is injected into the page by the background engine.
 */
import { setupGmRelay } from "./content/relay";

export function setupUserScriptsContent(): void {
  setupGmRelay();
}
