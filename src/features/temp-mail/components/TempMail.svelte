<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { COPY_MESSAGES, copyWithFeedback, isContextInvalidated } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { showToast } from "@/lib/toast";
  import { TEMPMAIL_ACTIONS } from "../constants/temp-mail.constants";
  import type {
    EmailMessage,
    InboxState,
    RetryNotice,
    TempEmail,
    TempMailCurrentState,
  } from "../types/temp-mail.types";
  import { retryNoticeText } from "../utils/provider-error.utils";
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
  
  let retry = $state<RetryNotice | null>(null);
  let noticeTimer: ReturnType<typeof setInterval> | null = null;
  let nowTick = $state(Date.now());

  let modalEmail = $state<EmailMessage | null>(null);

  const isActive = $derived(email !== null && remainingSeconds > 0);
  const notice = $derived(
    retry && retry.until > nowTick ? retryNoticeText(retry, nowTick) : null,
  );

  $effect(() => {
    const active = retry;
    if (!active) {
      stopNoticeTimer();
      return;
    }
    stopNoticeTimer();
    nowTick = Date.now();
    noticeTimer = setInterval(() => {
      nowTick = Date.now();
      if (active.until <= nowTick) retry = null;
    }, 1000);
  });

  function stopNoticeTimer(): void {
    if (!noticeTimer) return;
    clearInterval(noticeTimer);
    noticeTimer = null;
  }

  function showToastMsg(msg: string, isError = false): void {
    if (rootEl) showToast(rootEl, msg, { isError });
  }

  function errorText(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : "";
    return message || fallback;
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

  
  async function refreshInbox(force = false): Promise<RetryNotice | null> {
    try {
      const res = await sendMessage<InboxState>(TEMPMAIL_ACTIONS.GET_INBOX, { force });
      emails = res?.emails ?? [];
      retry = res?.retry ?? null;
      return retry;
    } catch (err) {
      if (!isContextInvalidated(err))
        console.error("[TempMail] Inbox refresh error:", errorText(err, "unknown"));
      return null;
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
        retry = null;
        showToastMsg("Generated new address!");
      }
    } catch (err) {
      if (isContextInvalidated(err)) return;
      const message = errorText(err, "Failed to generate address");
      console.warn("[TempMail] Generate error:", message);
      showToastMsg(message, true);
      
      retry = await refreshInbox();
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
      const noticeNow = await refreshInbox(true);
      if (noticeNow) showToastMsg(retryNoticeText(noticeNow), true);
      else showToastMsg("Inbox refreshed");
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

  async function handleCopy(text: string, successMsg?: string): Promise<void> {
    const message = await copyWithFeedback(text);
    const failed = message !== COPY_MESSAGES.success;
    showToastMsg(failed ? message : (successMsg ?? message), failed);
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
      retry = state?.retry ?? null;
      await refreshInbox();
    } catch (err) {
      if (!isContextInvalidated(err))
        console.error("[TempMail] Initial load error:", errorText(err, "unknown"));
    } finally {
      isRefreshing = false;
    }

    
    
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      void refreshInbox();
    }, 10_000);
  });

  onDestroy(() => {
    stopCountdown();
    stopNoticeTimer();
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<div bind:this={rootEl} class="flex flex-col gap-4 p-2.5 sm:p-3.5">
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
    {notice}
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