<script lang="ts">
  import Button from "@/components/Button.svelte";
  import Icon from "@/components/Icon.svelte";
  import type { EmailMessage } from "../types/temp-mail.types";
  import { extractOtpCode, sanitizeEmailHtml } from "../utils/temp-mail.utils";

  interface Props {
    email: EmailMessage | null;
    onClose: () => void;
    onDelete: () => void;
    onCopy: (text: string, msg?: string) => void;
  }
  let { email, onClose, onDelete, onCopy }: Props = $props();

  let allowRemoteImages = $state(false);

  const otpCode = $derived(
    email ? extractOtpCode(`${email.subject || ""} ${email.content || ""}`) : null,
  );

  const hasRemoteImages = $derived(
    Boolean(email?.content && /<img[^>]+src=["']https?:\/\//i.test(email.content))
  );

  const sanitizedContent = $derived(
    email?.content ? sanitizeEmailHtml(email.content) : ""
  );

  const cspString = $derived(
    `default-src 'none'; style-src 'unsafe-inline'; img-src data:${allowRemoteImages ? " https: http:" : ""}; font-src data:;`
  );
</script>

{#if email}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-ext-text/50 p-4"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && onClose()}
    onkeydown={(e) => e.key === "Escape" && onClose()}
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
            {email.subject || "(No Subject)"}
          </h3>
        </div>
        <button
          type="button"
          class="ml-2 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-ext-border bg-ext-surface text-ext-muted transition-all hover:bg-[#EDE7DA] hover:text-ext-text"
          title="Close"
          aria-label="Close"
          onclick={onClose}
          ><Icon name="close" size={13} /></button
        >
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <div class="mb-2.5 flex flex-col gap-0.5 text-xs text-ext-text-secondary">
          <div class="flex gap-1.5">
            <span class="shrink-0 font-bold uppercase tracking-wider text-ext-muted">From:</span>
            <span class="min-w-0 truncate font-semibold text-ext-text"
              >{email.from_address || "Unknown"}</span
            >
          </div>
          <div class="flex gap-1.5">
            <span class="shrink-0 font-bold uppercase tracking-wider text-ext-muted">Date:</span>
            <span class="text-ext-text-secondary">{new Date(email.received_at).toLocaleString()}</span>
          </div>
        </div>

        {#if otpCode}
          <div
            class="mb-3 flex items-center gap-2 rounded-lg border-[1.5px] border-ext-warning bg-[#FDF3E3] p-2.5"
          >
            <span class="text-[11.5px] font-bold uppercase tracking-wider text-[#C48C1E]"
              >Verification Code:</span
            >
            <span class="text-[14px] font-bold tracking-[0.15em] text-ext-text"
              >{otpCode}</span
            >
            <span class="ml-auto">
              <Button
                variant="secondary"
                size="sm"
                onclick={() => onCopy(otpCode!, "Verification code copied!")}
                >Copy Code</Button
              >
            </span>
          </div>
        {/if}

        {#if hasRemoteImages}
          <div
            class="mb-2 flex items-center justify-between rounded border border-ext-border bg-[#F5EFEB] px-2.5 py-1.5 text-[11px] text-ext-text-secondary"
          >
            <span>Remote images hidden to prevent tracking.</span>
            <button
              type="button"
              class="cursor-pointer font-semibold text-ext-primary underline hover:text-ext-primary-hover"
              onclick={() => (allowRemoteImages = !allowRemoteImages)}
            >
              {allowRemoteImages ? "Hide Images" : "Load Images"}
            </button>
          </div>
        {/if}

        {#if sanitizedContent}
          <iframe
            title="Email content"
            class="h-64 w-full rounded-lg border-[1.5px] border-ext-border bg-white"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcdoc={`<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="${cspString}"><base target="_blank"><style>body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;color:#1A1A1A;margin:8px;word-break:break-word;background:#FFFDF7;}img{max-width:100%;height:auto;}a{color:#1B4DDB;text-decoration:underline;cursor:pointer;font-weight:600;}a:hover{color:#0F3BA8;}</style></head><body>${sanitizedContent}</body></html>`}
          ></iframe>
        {:else}
          <p class="text-xs font-medium text-ext-muted">(Empty email content)</p>
        {/if}
      </div>

      <div class="flex justify-end border-t-[1.5px] border-ext-border bg-[#EDE7DA] px-3 py-2">
        <Button
          variant="danger"
          size="sm"
          onclick={onDelete}>Delete Message</Button
        >
      </div>
    </div>
  </div>
{/if}