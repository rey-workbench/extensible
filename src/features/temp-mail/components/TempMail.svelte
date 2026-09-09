<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Badge from "@/components/Badge.svelte";
  import Button from "@/components/Button.svelte";
  import CopyInput from "@/components/CopyInput.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import {
    copyToClipboard,
    formatRelativeTime,
    isContextInvalidated,
  } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { TEMPMAIL_ACTIONS } from "../constants/temp-mail.constants";
  import type {
    EmailMessage,
    InboxState,
    TempEmail,
    TempMailCurrentState,
  } from "../types/temp-mail.types";
  import { TempMailUtils } from "../utils/temp-mail.utils";

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
  const modalOtpCode = $derived(
    modalEmail
      ? TempMailUtils.extractOtpCode(
          `${modalEmail.subject || ""} ${modalEmail.content || ""}`,
        )
      : null,
  );

  const isActive = $derived(email !== null && remainingSeconds > 0);
  const emailValue = $derived(email ? email.address : "No active address");

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

  async function handleDelete(id: string | number): Promise<void> {
    try {
      await sendMessage<boolean>(TEMPMAIL_ACTIONS.DELETE_MESSAGE, {
        messageId: id,
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
  <!-- Active Address Card -->
  <div class="ext-card p-3 space-y-2.5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span
          class="h-2 w-2 rounded-full {isActive
            ? 'bg-ext-success'
            : 'bg-ext-muted'}"
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

    <CopyInput
      value={emailValue}
      readonly={true}
      oncopy={() => handleCopy(emailValue)}
    />

    <div class="grid grid-cols-2 gap-2 pt-0.5">
      <Button
        variant="primary"
        size="sm"
        icon="refresh"
        onclick={handleGenerate}
        disabled={isRefreshing}>New Address</Button
      >
      <Button
        variant="secondary"
        size="sm"
        icon="autofill"
        onclick={handleAutofill}>Autofill Page</Button
      >
    </div>
  </div>

  <!-- Inbox Section Bar -->
  <div
    class="flex h-6 shrink-0 items-center justify-between px-1"
  >
    <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ext-muted">
      <span>Inbox</span>
      <span class="rounded-sm border border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-0.2 text-[10px] font-bold text-ext-text-secondary"
        >{emails.length}</span
      >
    </div>
    <button
      type="button"
      class="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text disabled:opacity-50"
      title="Refresh Inbox"
      aria-label="Refresh Inbox"
      onclick={handleRefresh}
      disabled={isRefreshing}
    >
      <Icon
        name="refresh"
        size={12}
        class={isRefreshing ? "animate-spin text-ext-primary" : ""}
      />
    </button>
  </div>

  <!-- Inbox List -->
  <div class="flex flex-col space-y-1">
    {#if emails.length === 0}
      <div
        class="rounded-lg border-[1.5px] border-dashed border-ext-muted bg-ext-surface py-6 text-center text-xs font-medium text-ext-muted"
      >
        Inbox is currently empty
      </div>
    {:else}
      {#each emails as item (item.id)}
        <div
          class="ext-card flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition-all hover:bg-[#EDE7DA] {item.is_read
            ? 'opacity-70'
            : 'border-l-[3px] border-l-ext-primary'}"
          role="button"
          tabindex="0"
          onclick={() => (modalEmail = item)}
          onkeydown={(e) => e.key === "Enter" && (modalEmail = item)}
        >
          <span
            class="flex shrink-0 items-center justify-center {item.is_read
              ? 'text-ext-muted'
              : 'text-ext-primary'}"
          >
            <Icon name="mail" size={14} />
          </span>
          <div class="min-w-0 flex-1">
            <div
              class="truncate text-[12px] {item.is_read
                ? 'text-ext-text-secondary'
                : 'font-bold text-ext-text'}"
            >
              {item.from_address || "Unknown"}
            </div>
            <div class="truncate text-[11px] text-ext-muted">
              {item.subject || "(No Subject)"}
            </div>
          </div>
          <span class="shrink-0 text-[10px] font-medium text-ext-muted"
            >{formatRelativeTime(item.received_at)}</span
          >
        </div>
      {/each}
    {/if}
  </div>

  {#if modalEmail}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-ext-text/50 p-4"
      role="presentation"
      onclick={(e) => e.target === e.currentTarget && (modalEmail = null)}
      onkeydown={(e) => e.key === "Escape" && (modalEmail = null)}
    >
      <div
        class="ext-glass flex max-h-[85vh] w-full max-w-105 flex-col overflow-hidden rounded-lg"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="flex items-center justify-between border-b-[1.5px] border-ext-border bg-[#EDE7DA] px-3 py-2.5"
        >
          <div class="flex min-w-0 items-center gap-2">
            <h3 class="min-w-0 truncate text-[13px] font-bold text-ext-text">
              {modalEmail.subject || "(No Subject)"}
            </h3>
          </div>
          <button
            type="button"
            class="ml-2 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text"
            title="Close"
            aria-label="Close"
            onclick={() => (modalEmail = null)}
            ><Icon name="close" size={13} /></button
          >
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <div class="mb-2.5 flex flex-col gap-0.5 text-xs text-ext-text-secondary">
            <div class="flex gap-1.5">
              <span class="shrink-0 font-bold uppercase tracking-wider text-ext-muted">From:</span>
              <span class="min-w-0 truncate font-semibold text-ext-text"
                >{modalEmail.from_address || "Unknown"}</span
              >
            </div>
            <div class="flex gap-1.5">
              <span class="shrink-0 font-bold uppercase tracking-wider text-ext-muted">Date:</span>
              <span class="text-ext-text-secondary">{new Date(modalEmail.received_at).toLocaleString()}</span>
            </div>
          </div>

          {#if modalOtpCode}
            <div
              class="mb-3 flex items-center gap-2 rounded-lg border-[1.5px] border-ext-warning bg-[#FDF3E3] p-2.5"
            >
              <span class="text-[11.5px] font-bold uppercase tracking-wider text-[#C48C1E]"
                >Verification Code:</span
              >
              <span class="text-[14px] font-bold tracking-[0.15em] text-ext-text"
                >{modalOtpCode}</span
              >
              <span class="ml-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onclick={() =>
                    handleCopy(modalOtpCode!, "Verification code copied!")}
                  >Copy Code</Button
                >
              </span>
            </div>
          {/if}

          {#if modalEmail.content}
            <iframe
              title="Email content"
              class="h-64 w-full rounded-lg border-[1.5px] border-ext-border bg-white"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcdoc={`<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data:;"><base target="_blank"><style>@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');body{font-family:'Space Grotesk',system-ui,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;color:#1A1A1A;margin:8px;word-break:break-word;background:#FFFDF7;}img{max-width:100%;height:auto;}a{color:#1B4DDB;text-decoration:underline;cursor:pointer;font-weight:600;}a:hover{color:#0F3BA8;}</style></head><body>${modalEmail.content}</body></html>`}
            ></iframe>
          {:else}
            <p class="text-xs font-medium text-ext-muted">(Empty email content)</p>
          {/if}
        </div>

        <div class="flex justify-end border-t-[1.5px] border-ext-border bg-[#EDE7DA] px-3 py-2">
          <Button
            variant="danger"
            size="sm"
            onclick={() => handleDelete(modalEmail!.id)}>Delete Message</Button
          >
        </div>
      </div>
    </div>
  {/if}

  {#if toast}
    <div
      class="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border-[1.5px] border-ext-border bg-ext-surface px-3.5 py-1 text-[11px] font-bold text-ext-text shadow-[3px_3px_0_#1A1A1A]"
    >
      {toast}
    </div>
  {/if}
</div>
