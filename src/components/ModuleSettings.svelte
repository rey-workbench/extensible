<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Card from "@/components/Card.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import type { FeatureModule, SettingField } from "@/lib/feature-registry";

  interface Props {
    feature: FeatureModule;
  }
  let { feature }: Props = $props();

  const schema = $derived(feature.settings);

  let values = $state<Record<string, unknown>>({});
  let loaded = $state(false);
  let saved = $state("");
  let error = $state("");
  let savedTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    if (!schema) return;
    try {
      values = await schema.read();
    } catch {
      error = "Could not load settings";
    }
    loaded = true;
  });

  onDestroy(() => {
    if (savedTimer) clearTimeout(savedTimer);
  });

  async function patch(field: SettingField, value: unknown): Promise<void> {
    if (!schema) return;
    saved = "";
    error = "";
    try {
      values = await schema.write({ [field.key]: value });
      saved = `${field.label} saved`;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        saved = "";
      }, 2000);
    } catch (err) {
      error = err instanceof Error && err.message ? err.message : "Could not save";
    }
  }

  function hintFor(field: SettingField): string {
    if (field.kind !== "select") return field.hint ?? "";
    const current = String(values[field.key] ?? "");
    return field.options.find((o) => o.value === current)?.hint ?? field.hint ?? "";
  }
</script>

{#if schema}
  <div class="flex flex-col p-2.5 sm:p-3.5">
    <Card title={`${feature.name} settings`} icon="gear">
      {#if !loaded}
        <p class="text-body text-ext-text-secondary">Loading…</p>
      {:else}
        <div class="flex flex-col gap-3.5">
          {#each schema.fields as field (field.key)}
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="text-body font-bold text-ext-text">{field.label}</div>
                {#if hintFor(field)}
                  <div class="text-label text-ext-text-secondary">{hintFor(field)}</div>
                {/if}
              </div>

              {#if field.kind === "toggle"}
                <Toggle
                  checked={Boolean(values[field.key])}
                  label={field.label}
                  onchange={(v) => void patch(field, v)}
                />
              {:else if field.kind === "select"}
                <select
                  class="ext-field h-9 shrink-0 cursor-pointer rounded-lg px-2.5 text-body font-bold text-ext-text"
                  aria-label={field.label}
                  value={String(values[field.key] ?? "")}
                  onchange={(e) => void patch(field, e.currentTarget.value)}
                >
                  {#each field.options as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              {:else}
                <input
                  type="number"
                  class="ext-field h-9 w-20 shrink-0 rounded-lg px-2.5 text-right text-body font-bold text-ext-text"
                  aria-label={field.label}
                  value={Number(values[field.key] ?? 0)}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onchange={(e) => void patch(field, Number(e.currentTarget.value))}
                />
              {/if}
            </div>
          {/each}

          {#if error}
            <p class="text-label font-bold text-ext-danger-ink">{error}</p>
          {/if}
          {#if saved}
            <p class="text-label font-bold text-ext-success-ink">{saved}</p>
          {/if}
        </div>
      {/if}
    </Card>
  </div>
{/if}
