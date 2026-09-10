<script lang="ts">
  import ExtensionList from "@/components/ExtensionList.svelte";
  import Icon from "@/components/Icon.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import type { FeatureModule } from "@/lib/feature-registry";

  interface Props {
    logo48: string;
    features: FeatureModule[];
    enabledMap: Record<string, boolean>;
    masterOn: boolean;
    colorFor: (id: string) => string;
    onToggleAll: (enabled: boolean) => void;
    onClose: () => void;
    onOpenDetail: (id: string) => void;
    onToggleFeature: (feature: FeatureModule, enabled: boolean) => void;
  }
  let {
    logo48,
    features,
    enabledMap,
    masterOn,
    colorFor,
    onToggleAll,
    onClose,
    onOpenDetail,
    onToggleFeature,
  }: Props = $props();
</script>

<!-- Header -->
<header
  class="flex h-10.5 shrink-0 items-center justify-between border-b-[1.5px] border-ext-border bg-ext-surface px-3"
>
  <!-- Brand -->
  <div class="flex items-center gap-2">
    <img
      src={logo48}
      alt="Extensible Logo"
      class="h-6 w-6 rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface object-contain shadow-[1.5px_1.5px_0_#1A1A1A]"
    />
    <span class="text-[13px] font-bold uppercase tracking-wider text-ext-text">
      Extensible
    </span>
  </div>

  <!-- Right: Toolbar Action Icons -->
  <div class="flex items-center gap-2">
    <!-- Master Switch -->
    <span
      class="text-[10.5px] font-bold uppercase tracking-wider text-ext-muted"
    >{masterOn ? "All on" : "All off"}</span>
    <Toggle
      checked={masterOn}
      label={masterOn ? "Disable all extensions" : "Enable all extensions"}
      onchange={(v) => onToggleAll(v)}
    />

    <!-- Close Drawer button -->
    <button
      type="button"
      class="flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text active:translate-x-px active:translate-y-px"
      title="Close panel"
      aria-label="Close panel"
      onclick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <Icon name="close" size={11} />
    </button>
  </div>
</header>

<ExtensionList
  {features}
  {enabledMap}
  {colorFor}
  onOpenDetail={onOpenDetail}
  onToggleFeature={onToggleFeature}
/>