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

<div class="flex flex-col gap-2 p-2">
  <div class="rounded border border-slate-200 bg-white p-2 shadow-xs">
    <div class="mb-1.5 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span
          class="h-2 w-2 rounded-full {isActive
            ? 'bg-emerald-500'
            : 'bg-slate-300'}"
        ></span>
        <span class="text-[11px] font-medium text-slate-600"
          >{isActive ? "Active" : "Expired"}</span
        >
      </div>
      <span
        class="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-slate-600"
      >
        {isActive ? TempMailUtils.formatCountdown(remainingSeconds) : "00:00"}
      </span>
    </div>

    <CopyInput
      value={emailValue}
      readonly={true}
      oncopy={() => handleCopy(emailValue)}
    />

    <div class="mt-2 grid grid-cols-2 gap-1.5">
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

  <!-- Inbox Section Bar (Extensible Gradient) -->
  <div
    class="ext-gradient-bar flex h-[21px] shrink-0 items-center justify-between px-2 text-white"
  >
    <div class="flex items-center gap-1.5 text-[11px] font-bold">
      <span>INBOX</span>
      <span class="rounded bg-white/20 px-1 py-0.2 text-[10px] font-semibold"
        >{emails.length}</span
      >
    </div>
    <button
      type="button"
      class="inline-flex h-4.5 w-4.5 cursor-pointer items-center justify-center text-white/80 transition-colors hover:text-white disabled:opacity-50"
      title="Refresh Inbox"
      aria-label="Refresh Inbox"
      onclick={handleRefresh}
      disabled={isRefreshing}
    >
      <Icon
        name="refresh"
        size={12}
        class={isRefreshing ? "animate-spin" : ""}
      />
    </button>
  </div>

  <!-- Inbox List -->
  <div class="flex flex-col">
    {#if emails.length === 0}
      <div
        class="rounded border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400"
      >
        Inbox is currently empty
      </div>
    {:else}
      {#each emails as item (item.id)}
        <div
          class="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-1.5 py-1.5 transition-colors
            {item.is_read
            ? 'bg-white hover:bg-slate-50'
            : 'bg-blue-50/50 hover:bg-blue-50'}"
          role="button"
          tabindex="0"
          onclick={() => (modalEmail = item)}
          onkeydown={(e) => e.key === "Enter" && (modalEmail = item)}
        >
          <span
            class="flex shrink-0 items-center justify-center text-slate-400"
          >
            <Icon name="mail" size={13} />
          </span>
          <div class="min-w-0 flex-1">
            <div
              class="truncate text-[11.5px] {item.is_read
                ? 'text-slate-600'
                : 'font-semibold text-slate-800'}"
            >
              {item.from_address || "Unknown"}
            </div>
            <div class="truncate text-[10.5px] text-slate-400">
              {item.subject || "(No Subject)"}
            </div>
          </div>
          <span class="shrink-0 text-[9.5px] text-slate-400"
            >{formatRelativeTime(item.received_at)}</span
          >
        </div>
      {/each}
    {/if}
  </div>

  {#if modalEmail}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onclick={(e) => e.target === e.currentTarget && (modalEmail = null)}
      onkeydown={(e) => e.key === "Escape" && (modalEmail = null)}
    >
      <div
        class="flex max-h-[80vh] w-full max-w-105 flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2"
        >
          <h3 class="min-w-0 truncate text-sm font-semibold text-slate-800">
            {modalEmail.subject || "(No Subject)"}
          </h3>
          <button
            type="button"
            class="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
            title="Close"
            aria-label="Close"
            onclick={() => (modalEmail = null)}
            ><Icon name="close" size={15} /></button
          >
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
          <div class="mb-2 flex flex-col gap-0.5 text-xs text-slate-600">
            <div class="flex gap-1.5">
              <span class="shrink-0 font-medium text-slate-400">From:</span>
              <span class="min-w-0 truncate"
                >{modalEmail.from_address || "Unknown"}</span
              >
            </div>
            <div class="flex gap-1.5">
              <span class="shrink-0 font-medium text-slate-400">Date:</span>
              <span>{new Date(modalEmail.received_at).toLocaleString()}</span>
            </div>
          </div>

          {#if modalOtpCode}
            <div
              class="mb-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2"
            >
              <span class="text-[11px] font-medium text-amber-700"
                >Verification Code:</span
              >
              <span class="text-sm font-bold tracking-wider text-amber-800"
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
              class="h-64 w-full rounded border border-slate-200 bg-white"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcdoc={`<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data:;"><base target="_blank"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;color:#202124;margin:8px;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#2563eb;text-decoration:underline;cursor:pointer;}a:hover{color:#1d4ed8;}</style></head><body>${modalEmail.content}</body></html>`}
            ></iframe>
          {:else}
            <p class="text-xs text-slate-400">(Empty email content)</p>
          {/if}
        </div>

        <div class="flex justify-end border-t border-slate-200 px-3 py-2">
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
      class="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-900/90 px-3 py-1.5 text-[11px] font-medium text-slate-100 shadow-lg"
    >
      {toast}
    </div>
  {/if}
</div>
