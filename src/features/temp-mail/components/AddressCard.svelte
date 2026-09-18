<script lang="ts">
  import Button from "@/components/Button.svelte";
  import CopyInput from "@/components/CopyInput.svelte";
  import { sendMessage } from "@/lib/messaging";
  import { TEMPMAIL_ACTIONS } from "../constants/temp-mail.constants";
  import type { TempEmail } from "../types/temp-mail.types";
  import { formatCountdown } from "../utils/temp-mail.utils";

  interface Props {
    email: TempEmail | null;
    remainingSeconds: number;
    isActive: boolean;
    isRefreshing: boolean;
    onGenerate: () => void;
    onAutofill: () => void;
    onCopy: (text: string, msg?: string) => void;
  }
  let {
    email,
    remainingSeconds,
    isActive,
    isRefreshing,
    onGenerate,
    onAutofill,
    onCopy,
  }: Props = $props();

  const emailValue = $derived(email ? email.address : "No active address");
</script>

<div class="ext-card space-y-3.5 p-4">
  <div class="flex items-center justify-between">
    <span class="text-body font-bold {isActive ? 'text-ext-text' : 'text-ext-text-secondary'}">
      {isActive ? "Active Address" : "Expired"}
    </span>
    <span
      class="rounded-full border border-ext-border/70 bg-ext-subtle-strong px-2.5 py-0.5 text-xs font-bold tabular-nums text-ext-text-secondary"
    >
      {isActive ? formatCountdown(remainingSeconds) : "00:00"}
    </span>
  </div>

  <CopyInput value={emailValue} readonly={true} oncopy={() => onCopy(emailValue)} />

  <div class="grid grid-cols-2 gap-2.5 pt-0.5">
    <Button
      variant="primary"
      size="md"
      icon="refresh"
      onclick={onGenerate}
      disabled={isRefreshing}>New Address</Button
    >
    <Button
      variant="secondary"
      size="md"
      icon="autofill"
      onclick={onAutofill}>Autofill Page</Button
    >
  </div>
</div>