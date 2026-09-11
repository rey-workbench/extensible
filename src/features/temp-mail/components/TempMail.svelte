<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { copyToClipboard, isContextInvalidated } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { showToast } from "@/lib/toast";
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
  let rootEl = $state<HTMLElement | null>(null);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  
  let modalEmail = $state<EmailMessage | null>(null);

  const isActive = $derived(email !== null && remainingSeconds > 0);

  function showToastMsg(msg: string): void {
    if (rootEl) showToast(rootEl, msg);
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
        showToastMsg("Generated new address!");
      }
    } catch (err) {
      if (isContextInvalidated(err)) return;
      console.error("[TempMail] Generate error:", err);
      showToastMsg("Failed to generate address");
    } finally {
      isRefreshing = false;
    }
  }

  async function handleAutofill(): Promise<void> {
    try {
      const success = await sendMessage<boolean>(
        TEMPMAIL_ACTIONS.AUTOFILL_ACTIVE_TAB,
      );
      showToastMsg(
        success
          ? "Filled email into page!"
          : "No email field found on active tab",
      );
    } catch (err) {
      if (isContextInvalidated(err)) return;
      showToastMsg("Autofill failed");
    }
  }

  async function handleRefresh(): Promise<void> {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      await refreshInbox();
      showToastMsg("Inbox refreshed");
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
      showToastMsg("Message deleted");
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
    if (ok) showToastMsg(successMsg);
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

    
    pollTimer = setInterval(() => void refreshInbox(), 10_000);
  });

  onDestroy(() => {
    stopCountdown();
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<div bind:this={rootEl} class="flex flex-col gap-2.5 p-2.5">
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
</div>