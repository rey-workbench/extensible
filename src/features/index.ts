/**
 * Feature self-registration entrypoint.
 *
 * Importing this module registers every feature into the shared registry.
 * Entrypoints import it once (for side effects) and iterate `getFeatures()`
 * instead of hardcoding per-feature setup calls. Adding a new feature is now
 * just creating `src/features/<id>/register.ts` — no edits needed here.
 *
 * The glob eagerly imports every `src/features/<id>/register.ts`, whose
 * `defineFeature(...)` side effect registers the feature at load time.
 */
void import.meta.glob("./*/register.ts", { eager: true });
