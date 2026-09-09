/**
 * Feature self-registration entrypoint.
 *
 * Importing this module registers every feature into the shared registry.
 * Entrypoints import it once (for side effects) and iterate `getFeatures()`
 * instead of hardcoding per-feature setup calls. Adding a new feature =
 * create `src/features/<id>/` with a `register.ts` and add one import here.
 */
import "./ai-exporter/register";
import "./side-notch/register";
import "./temp-mail/register";
