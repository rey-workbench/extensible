<script lang="ts">
  import Icon from "@/components/Icon.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import { type FeatureModule, getFeatureColor } from "@/lib/feature-registry";
  import { isEnabledIn } from "@/lib/feature-settings";

  interface Props {
    logo48: string;
    features: FeatureModule[];
    enabledMap: Record<string, boolean>;
    masterOn: boolean;
    activeTempAddress: string | null;
    isGeneratingMail: boolean;
    scriptStats: { total: number; enabled: number };
    onToggleAll: (enabled: boolean) => void;
    onToggleFeature: (feature: FeatureModule, enabled: boolean) => void;
    onOpenDetail: (id: string) => void;
    onQuickGenerate: () => void;
    onQuickCopy: () => void;
    onClose: () => void;
  }

  let {
    logo48,
    features,
    enabledMap,
    masterOn,
    activeTempAddress,
    isGeneratingMail,
    scriptStats,
    onToggleAll,
    onToggleFeature,
    onOpenDetail,
    onQuickGenerate,
    onQuickCopy,
    onClose,
  }: Props = $props();

  let searchQuery = $state("");

  const filteredFeatures = $derived(
    features.filter((f) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      );
    }),
  );

  const activeCount = $derived(
    features.filter((f) => isEnabledIn(enabledMap, f.id)).length,
  );

  
  const hasAiToolkit = $derived(filteredFeatures.some((f) => f.id === "ai-toolkit"));
  const hasUserScripts = $derived(filteredFeatures.some((f) => f.id === "user-scripts"));
  const hasTempMail = $derived(filteredFeatures.some((f) => f.id === "temp-mail"));

  function featureById(id: string): FeatureModule | undefined {
    return features.find((f) => f.id === id);
  }

  function toggleById(id: string, enabled: boolean): void {
    const feature = featureById(id);
    if (feature) onToggleFeature(feature, enabled);
  }
</script>

<div class="w-full max-w-5xl select-none text-ext-text">
  
  <div class="mb-5 flex shrink-0 items-stretch gap-3">
    
    <div
      class="flex h-15 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-ext-border bg-ext-surface px-5 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.22)]"
    >
      <img src={logo48} alt="Extensible" class="h-10 w-10 shrink-0 object-contain" />
      <div class="flex min-w-0 flex-col leading-tight">
        <h2 class="truncate text-hero font-extrabold tracking-tight text-ext-text">
          Extensible Hub
        </h2>
        <p class="truncate text-xs font-medium text-ext-text-secondary">
          Modular Browser Workspace
        </p>
      </div>
    </div>

    
    <div
      class="hidden h-15 w-72 items-center gap-2.5 rounded-2xl border border-ext-border bg-ext-surface px-4 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.22)] transition-all focus-within:border-ext-primary/40 focus-within:ring-2 focus-within:ring-ext-primary/15 sm:flex"
    >
      <Icon name="search" size={14} class="shrink-0 text-ext-muted" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search apps & tools…"
        class="h-full w-full bg-transparent text-body text-ext-text outline-none placeholder:text-ext-muted"
      />
      {#if searchQuery}
        <button
          type="button"
          class="cursor-pointer text-ext-muted hover:text-ext-text"
          onclick={() => (searchQuery = "")}
          aria-label="Clear search"
        >
          <Icon name="close" size={13} />
        </button>
      {/if}
    </div>

    
    <button
      type="button"
      role="switch"
      aria-checked={masterOn}
      title="Toggle all modules"
      class="flex h-15 shrink-0 cursor-pointer items-center gap-3 whitespace-nowrap rounded-2xl border border-ext-border bg-ext-surface px-5 text-body font-semibold text-ext-text-secondary shadow-[0_10px_30px_-14px_rgba(15,23,42,0.22)] transition-all hover:bg-ext-subtle active:scale-95"
      onclick={() => onToggleAll(!masterOn)}
    >
      <span>All Modules</span>
      <span
        class="relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 {masterOn
          ? 'bg-ext-success'
          : 'bg-ext-border-strong'}"
      >
        <span
          class="absolute top-0.5 h-4 w-4 rounded-full bg-ext-surface shadow-[0_1px_3px_rgba(15,23,42,0.25)] transition-all duration-200 {masterOn
            ? 'left-4.5'
            : 'left-0.5'}"
        ></span>
      </span>
    </button>

    
    <button
      type="button"
      class="ext-close-btn h-15 w-15 shrink-0 rounded-2xl"
      onclick={onClose}
      title="Close (Esc)"
      aria-label="Close"
    >
      <Icon name="close" size={20} />
    </button>
  </div>

  
  <div class="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
    
    <div class="flex flex-col gap-5">
      
      <div class="ext-card flex items-center justify-between p-5">
        <div>
          <div class="text-label font-bold tracking-wider text-ext-text-secondary uppercase">
            Total Active
          </div>
          <div class="text-lg font-black text-ext-text">
            {activeCount} of {features.length} Modules
          </div>
        </div>
        <div
          class="rounded-full border border-ext-success-soft-border bg-ext-success-soft px-2.5 py-1 text-body font-bold text-ext-success-ink"
        >
          {activeCount === features.length ? "All OK" : "Partial"}
        </div>
      </div>

      
      {#if hasAiToolkit}
        <div
          class="ext-card-coral relative flex cursor-pointer flex-col justify-between overflow-hidden p-6 transition-all hover:scale-[1.01] hover:shadow-xl {enabledMap['ai-toolkit'] === false
            ? 'saturate-50 opacity-70'
            : ''}"
          onclick={() => onOpenDetail("ai-toolkit")}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && onOpenDetail("ai-toolkit")}
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-body font-bold tracking-wider text-white/90 uppercase">
                AI Toolkit
              </span>
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full bg-ext-surface/20 text-white backdrop-blur-sm transition-transform hover:scale-110"
              >
                <svg
                  class="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <span class="ext-chip-glass">ChatGPT</span>
              <span class="ext-chip-glass">Claude</span>
              <span class="ext-chip-glass">Gemini</span>
            </div>
          </div>

          
          <div class="mt-5 h-14 w-full">
            <svg
              viewBox="0 0 160 50"
              class="h-full w-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="coralWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stop-color="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>
              <path
                d="M 0 32 Q 30 12, 60 30 T 110 16 T 160 28 L 160 50 L 0 50 Z"
                fill="url(#coralWave)"
              />
              <path
                d="M 0 32 Q 30 12, 60 30 T 110 16 T 160 28"
                fill="none"
                stroke="#ffffff"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          </div>
        </div>
      {/if}

      
      <div class="ext-card flex flex-col p-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-heading font-bold text-ext-text">Apps &amp; Extensions</h3>
          <span class="text-label font-medium text-ext-text-secondary">
            {filteredFeatures.length} modules
          </span>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each filteredFeatures as feature (feature.id)}
            {@const isEnabled = isEnabledIn(enabledMap, feature.id)}
            {@const hasDescription = !!feature.description?.trim()}
            {@const accent = getFeatureColor(feature.id)}
            {#if hasDescription}
              
              <div
                class="group col-span-2 flex min-h-28 items-center gap-3.5 rounded-2xl border border-ext-border/70 bg-ext-surface px-4 py-3.5 transition-all hover:border-blue-400 hover:shadow-md {isEnabled
                  ? ''
                  : 'opacity-65'}"
              >
                <button
                  type="button"
                  class="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 border-0 bg-transparent p-0 text-left"
                  onclick={() => onOpenDetail(feature.id)}
                  title={feature.description}
                  aria-label="Open {feature.name}"
                >
                  <span
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 {isEnabled
                      ? ''
                      : 'grayscale'}"
                    style="background: {accent}15; color: {accent};"
                  >
                    <Icon name={feature.icon} size={22} />
                  </span>
                  <span class="flex min-w-0 flex-col gap-0.5">
                    <span
                      class="truncate text-sm font-bold text-ext-text transition-colors group-hover:text-blue-600"
                    >
                      {feature.name}
                    </span>
                    <span class="line-clamp-2 text-body font-medium text-ext-text-secondary">
                      {feature.description}
                    </span>
                  </span>
                </button>
                <Toggle
                  checked={isEnabled}
                  label="{isEnabled ? 'Disable' : 'Enable'} {feature.name}"
                  onchange={(v) => onToggleFeature(feature, v)}
                />
              </div>
            {:else}
              
              <div
                class="group flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-2xl border border-ext-border/70 bg-ext-surface px-2 py-3.5 transition-all hover:border-blue-400 hover:shadow-md {isEnabled
                  ? ''
                  : 'opacity-65'}"
              >
                <button
                  type="button"
                  class="flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0"
                  onclick={() => onOpenDetail(feature.id)}
                  title={feature.name}
                  aria-label="Open {feature.name}"
                >
                  <span
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 {isEnabled
                      ? ''
                      : 'grayscale'}"
                    style="background: {accent}15; color: {accent};"
                  >
                    <Icon name={feature.icon} size={22} />
                  </span>
                  <span class="sr-only">{feature.name}</span>
                </button>
                <Toggle
                  checked={isEnabled}
                  label="{isEnabled ? 'Disable' : 'Enable'} {feature.name}"
                  onchange={(v) => onToggleFeature(feature, v)}
                />
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>

    
    <div class="flex flex-col gap-5">
      
      {#if hasTempMail}
        <div
          class="ext-card flex flex-col p-6 {isEnabledIn(enabledMap, 'temp-mail')
            ? ''
            : 'opacity-70'}"
        >
          <div class="flex items-center justify-between">
            <span class="text-label font-bold tracking-wider text-ext-text-secondary uppercase">
              Disposable Mail
            </span>
            <div class="flex items-center gap-2">
              <Toggle
                checked={isEnabledIn(enabledMap, "temp-mail")}
                label="Toggle Temp Mail"
                onchange={(v) => toggleById("temp-mail", v)}
              />
              <button
                type="button"
                class="ext-arrow-btn"
                onclick={() => onOpenDetail("temp-mail")}
                title="Open TempMail Inbox"
              >
                <svg
                  class="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </button>
            </div>
          </div>

          <div
            class="mt-3 truncate font-mono text-xl font-black tracking-tight text-ext-text"
            title={activeTempAddress ?? "Click generate below"}
          >
            {activeTempAddress ?? "Click generate below"}
          </div>

          <div class="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-ext-border-strong bg-ext-surface px-4 py-2 text-body font-bold text-ext-text-secondary shadow-sm transition-all hover:border-ext-border-strong hover:bg-ext-subtle active:scale-95"
              onclick={onQuickCopy}
            >
              Copy
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-xl bg-ext-primary px-4 py-2 text-body font-bold text-white shadow-sm transition-all hover:bg-ext-primary-dark active:scale-95 disabled:opacity-50"
              disabled={isGeneratingMail}
              onclick={onQuickGenerate}
            >
              {isGeneratingMail ? "Generating…" : "New"}
            </button>
          </div>
        </div>
      {/if}

      
      {#if hasUserScripts}
        <button
          type="button"
          class="ext-card flex w-full cursor-pointer flex-col p-6 text-left transition-all hover:scale-[1.01] hover:shadow-xl {enabledMap['user-scripts'] === false
            ? 'opacity-70'
            : ''}"
          onclick={() => onOpenDetail("user-scripts")}
        >
          <div class="flex items-center justify-between">
            <span class="text-label font-bold tracking-wider text-ext-text-secondary uppercase">
              User Scripts
            </span>
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full text-ext-text-secondary transition-colors hover:bg-ext-subtle-strong hover:text-ext-text"
            >
              <svg
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </span>
          </div>

          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-2xl font-black tracking-tight text-ext-text">
              {scriptStats.enabled}
            </span>
            <span class="text-heading font-bold text-ext-text-secondary">
              of {scriptStats.total} active
            </span>
          </div>
          <p class="mt-0.5 text-xs font-medium text-ext-text-secondary">
            GM_* APIs · MV3 native runner
          </p>

          <div
            class="mt-4 rounded-xl bg-ext-subtle px-3 py-2 font-mono text-xs text-ext-muted"
          >
            Injected on page load
          </div>
        </button>
      {/if}
    </div>
  </div>
</div>
