<script lang="ts">
  import Icon from "@/components/Icon.svelte";
  import ModuleSettings from "@/components/ModuleSettings.svelte";
  import type { FeatureModule } from "@/lib/feature-registry";

  
  export interface ModuleApi {
    openEditorFor?: (scriptId: string) => void;
    installFromCapturedUrl?: (url: string) => void;
  }

  interface Props {
    feature: FeatureModule | null;
    onBack: () => void;
    onClose: () => void;
    onModuleApi?: (api: ModuleApi | null) => void;
  }
  let { feature, onBack, onClose, onModuleApi }: Props = $props();

  let moduleInstance = $state<unknown>(null);
  let lastApi: ModuleApi | null = null;

  
  
  let settingsFor = $state<string | null>(null);
  const showSettings = $derived(
    Boolean(feature?.settings) && settingsFor === feature?.id,
  );

  $effect(() => {
    const api =
      moduleInstance && typeof moduleInstance === "object"
        ? (moduleInstance as ModuleApi)
        : null;
    if (api !== lastApi) {
      lastApi = api;
      onModuleApi?.(api);
    }
  });

</script>

<div class="flex max-h-[88vh] w-full flex-col">
  
  <div class="flex shrink-0 items-stretch gap-3">
    
    <button
      type="button"
      class="ext-hub-panel ext-hub-action flex h-15 w-15 shrink-0 items-center justify-center text-ext-text-secondary hover:text-ext-text"
      onclick={onBack}
      title="Back to Hub"
      aria-label="Back to Hub"
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    
    <div
      class="ext-hub-panel flex h-15 min-w-0 flex-1 flex-col justify-center px-5"
    >
      <h2 class="truncate text-hero font-extrabold tracking-tight text-ext-text">
        {feature?.name ?? "Module"}
      </h2>
      {#if feature?.description}
        <p class="truncate text-xs font-medium text-ext-text-secondary">
          {feature.description}
        </p>
      {/if}
    </div>

    
    {#if feature?.settings}
      <button
        type="button"
        class="ext-hub-panel ext-hub-action flex h-15 w-15 shrink-0 items-center justify-center hover:text-ext-text {showSettings
          ? 'text-ext-text'
          : 'text-ext-text-secondary'}"
        onclick={() => (settingsFor = showSettings ? null : (feature?.id ?? null))}
        title={showSettings ? "Back to module" : "Module settings"}
        aria-label={showSettings ? "Back to module" : "Module settings"}
        aria-pressed={showSettings}
      >
        <Icon name="gear" size={17} />
      </button>
    {/if}

    
    <button
      type="button"
      class="ext-close-btn h-15 w-15 shrink-0 rounded-2xl"
      onclick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      title="Close (Esc)"
      aria-label="Close"
    >
      <Icon name="close" size={18} />
    </button>
  </div>

  
  <div class="mt-3 min-h-0 flex-1 overflow-y-auto">
    {#if feature?.popup}
      {@const DetailView = feature.popup}
      
      
      <div class={showSettings ? "hidden" : ""}>
        <DetailView bind:this={moduleInstance} />
      </div>
    {/if}
    {#if showSettings && feature}
      <ModuleSettings {feature} />
    {/if}
  </div>
</div>
