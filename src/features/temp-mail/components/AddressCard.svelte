<script lang="ts">
  import Button from "@/components/Button.svelte";
  import CopyInput from "@/components/CopyInput.svelte";
  import { sendMessage } from "@/lib/messaging";
  import { TEMPMAIL_ACTIONS } from "../constants/temp-mail.constants";
  import type { TempEmail } from "../types/temp-mail.types";
  import { TempMailUtils } from "../utils/temp-mail.utils";

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

<div class="ext-card space-y-2.5 p-3">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-1.5">
      <span
        class="h-2 w-2 rounded-full {isActive ? 'bg-ext-success' : 'bg-ext-muted'}"
      ></span>
      <span class="text-[11.5px] font-bold text-ext-text"
        >{isActive ? "Active Address" : "Expired"}</span
      >
    </div>
    <span
      class="rounded-sm border border-[#D4CEC2] bg-[#EDE7DA] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-ext-text-secondary"
    >
      {isActive ? TempMailUtils.formatCountdown(remainingSeconds) : "00:00"}
    </span>
  </div>

  <CopyInput value={emailValue} readonly={true} oncopy={() => onCopy(emailValue)} />

  <div class="grid grid-cols-2 gap-2 pt-0.5">
    <Button
      variant="primary"
      size="sm"
      icon="refresh"
      onclick={onGenerate}
      disabled={isRefreshing}>New Address</Button
    >
    <Button
      variant="secondary"
      size="sm"
      icon="autofill"
      onclick={onAutofill}>Autofill Page</Button
    >
  </div>
</div>