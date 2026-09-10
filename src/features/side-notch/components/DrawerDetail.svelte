<script lang="ts">
  import Icon from "@/components/Icon.svelte";
  import type { FeatureModule } from "@/lib/feature-registry";

  interface Props {
    feature: FeatureModule | null;
    onBack: () => void;
    onClose: () => void;
  }
  let { feature, onBack, onClose }: Props = $props();
</script>

<header
  class="flex h-10.5 shrink-0 items-center justify-between border-b-[1.5px] border-solid border-ext-border bg-ext-surface px-3"
>
  <button
    type="button"
    class="flex cursor-pointer items-center gap-1 rounded-[5px] py-1 pr-2 text-[12.5px] font-bold uppercase tracking-wide text-ext-text-secondary transition-colors hover:bg-[#EDE7DA] hover:text-ext-text"
    onclick={onBack}
  >
    <svg
      class="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
    <span>Extensions</span>
  </button>
  <div class="flex items-center gap-1.5">
    <span class="max-w-37.5 truncate text-[12.5px] font-bold text-ext-text">
      {feature?.name ?? ""}
    </span>
    <button
      type="button"
      class="flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-solid border-ext-border bg-ext-surface text-ext-muted shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
      title="Close"
      onclick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <Icon name="close" size={11} />
    </button>
  </div>
</header>
<div class="min-h-0 flex-1 overflow-y-auto">
  {#if feature?.popup}
    {@const DetailView = feature.popup}
    <DetailView />
  {/if}
</div>