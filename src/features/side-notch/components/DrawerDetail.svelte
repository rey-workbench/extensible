<script lang="ts">
  import Icon from "@/components/Icon.svelte";
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
      class="flex h-15 w-15 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-600 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.22)] transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
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
      class="flex h-15 min-w-0 flex-1 flex-col justify-center rounded-2xl border border-slate-100 bg-white px-5 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.22)]"
    >
      <h2 class="truncate text-hero font-extrabold tracking-tight text-slate-900">
        {feature?.name ?? "Module"}
      </h2>
      {#if feature?.description}
        <p class="truncate text-xs font-medium text-ext-text-secondary">
          {feature.description}
        </p>
      {/if}
    </div>

    
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
      <DetailView bind:this={moduleInstance} />
    {/if}
  </div>
</div>
