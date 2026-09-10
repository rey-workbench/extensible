<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { copyToClipboard, isContextInvalidated } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { TEMPMAIL_ACTIONS } from "../constants/temp-mail.constants";
  import type {
    EmailMessage,
    InboxState,
    TempEmail,
    TempMailCurrentState,
  } from "../types/temp-mail.types";
  import AddressCard from "./AddressCard.svelte";
  import InboxList from "./InboxList.svelte";
  import MailModal from "./MailModal.svelte";

  let email = $state<TempEmail | null>(null);
  let remainingSeconds = $state(0);
  let emails = $state<EmailMessage[]>([]);
  let isRefreshing = $state(false);
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  // Modal state
  let modalEmail = $state<EmailMessage | null>(null);

  const isActive = $derived(email !== null && remainingSeconds > 0);

  function showToast(msg: string): void {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 2000);
  }

  function startCountdown(initial: number): void {
    stopCountdown();
    remainingSeconds = initial;
    countdownTimer = setInterval(() => {
      remainingSeconds = Math.max(0, remainingSeconds - 1);
      if (remainingSeconds <= 0) stopCountdown();
    }, 1000);
  }

  function stopCountdown(): void {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  async function refreshInbox(): Promise<void> {
    try {
      const res = await sendMessage<InboxState>(TEMPMAIL_ACTIONS.GET_INBOX);
      emails = res?.emails ?? [];
    } catch (err) {
      if (!isContextInvalidated(err))
        console.error("[TempMail] Inbox refresh error:", err);
    }
  }

  async function handleGenerate(): Promise<void> {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const newEmail = await sendMessage<TempEmail>(
        TEMPMAIL_ACTIONS.GENERATE_NEW,
      );
      if (newEmail) {
        email = newEmail;
        startCountdown((newEmail.durationMinutes ?? 60) * 60);
        emails = [];
        showToast("Generated new address!");
      }
    } catch (err) {
      if (isContextInvalidated(err)) return;
      console.error("[TempMail] Generate error:", err);
      showToast("Failed to generate address");
    } finally {
      isRefreshing = false;
    }
  }

  async function handleAutofill(): Promise<void> {
    try {
      const success = await sendMessage<boolean>(
        TEMPMAIL_ACTIONS.AUTOFILL_ACTIVE_TAB,
      );
      showToast(
        success
          ? "Filled email into page!"
          : "No email field found on active tab",
      );
    } catch (err) {
      if (isContextInvalidated(err)) return;
      showToast("Autofill failed");
    }
  }

  async function handleRefresh(): Promise<void> {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      await refreshInbox();
      showToast("Inbox refreshed");
    } catch (err) {
      if (isContextInvalidated(err)) return;
      console.error("[TempMail] Refresh error:", err);
    } finally {
      isRefreshing = false;
    }
  }

  async function handleDelete(): Promise<void> {
    if (!modalEmail) return;
    try {
      await sendMessage<boolean>(TEMPMAIL_ACTIONS.DELETE_MESSAGE, {
        messageId: modalEmail.id,
      });
      modalEmail = null;
      showToast("Message deleted");
      await refreshInbox();
    } catch (err) {
      if (isContextInvalidated(err)) return;
      console.error("[TempMail] Delete error:", err);
    }
  }

  async function handleCopy(
    text: string,
    successMsg = "Copied to clipboard!",
  ): Promise<void> {
    const ok = await copyToClipboard(text);
    if (ok) showToast(successMsg);
  }

  onMount(async () => {
    try {
      isRefreshing = true;
      const state = await sendMessage<TempMailCurrentState>(
        TEMPMAIL_ACTIONS.GET_CURRENT,
        {
          autoGenerate: true,
        },
      );
      if (state?.email) {
        email = state.email;
        startCountdown(state.remainingSeconds);
      }
      await refreshInbox();
    } catch (err) {
      if (!isContextInvalidated(err))
        console.error("[TempMail] Initial load error:", err);
    } finally {
      isRefreshing = false;
    }

    // Lightweight fallback poll every 10s
    pollTimer = setInterval(() => void refreshInbox(), 10_000);
  });

  onDestroy(() => {
    stopCountdown();
    if (pollTimer) clearInterval(pollTimer);
    if (toastTimer) clearTimeout(toastTimer);
  });
</script>

<div class="flex flex-col gap-2.5 p-2.5">
  <AddressCard
    {email}
    {remainingSeconds}
    {isActive}
    {isRefreshing}
    onGenerate={() => void handleGenerate()}
    onAutofill={() => void handleAutofill()}
    onCopy={(t, m) => void handleCopy(t, m)}
  />

  <InboxList
    {emails}
    {isRefreshing}
    onRefresh={() => void handleRefresh()}
    onOpen={(item) => (modalEmail = item)}
  />

  <MailModal
    email={modalEmail}
    onClose={() => (modalEmail = null)}
    onDelete={() => void handleDelete()}
    onCopy={(t, m) => void handleCopy(t, m)}
  />

  {#if toast}
    <div
      class="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border-[1.5px] border-ext-border bg-ext-surface px-3.5 py-1 text-[11px] font-bold text-ext-text shadow-[3px_3px_0_#1A1A1A]"
    >
      {toast}
    </div>
  {/if}
</div>