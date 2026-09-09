import {
  type ExecutionContext,
  ExtensionUtils,
  MessageRouterService,
  StorageService,
} from "@/core/index";
import { TEMPMAIL_ACTIONS, TEMPMAIL_STORAGE_KEYS } from "@/modules/temp-mail/constants/index";
import type {
  EmailMessage,
  TempEmail,
  TempMailCurrentState,
} from "@/modules/temp-mail/types/index";
import { TempMailPopupView } from "@/modules/temp-mail/views/temp-mail-popup.view";

/**
 * Controller mediating between Popup View and extension services.
 * Implements the standard mount(container) and unmount() contract for the PopupShell.
 */
export class TempMailPopupController {
  public static readonly contextType: ExecutionContext = "popup";
  public static readonly inject = [MessageRouterService, StorageService] as const;

  public view: TempMailPopupView | null = null;
  private _pollInterval: ReturnType<typeof setInterval> | null = null;
  private _inboxWatcher: (() => void) | null = null;
  private _refreshInFlight = false;

  constructor(
    private readonly router: MessageRouterService,
    private readonly storage: StorageService
  ) {}

  async mount(container: HTMLElement): Promise<void> {
    this.view = new TempMailPopupView(container);
    this.view.renderLayout();
    this._bindViewEvents();
    this._bindInboxWatcher();
    await this.refreshState();

    // Background already polls every 15s via alarm. Popup only needs a
    // lightweight fallback poll while visible — interval widened to 10s
    // and guarded against overlap so we don't double-hit the API.
    this._pollInterval = setInterval(() => {
      void this.refreshInbox(false);
    }, 10_000);
  }

  private _bindInboxWatcher(): void {
    if (this._inboxWatcher) return;
    this._inboxWatcher = this.storage.watch<EmailMessage[]>(
      TEMPMAIL_STORAGE_KEYS.INBOX_CACHE,
      (newInbox) => {
        if (Array.isArray(newInbox)) {
          this.view?.renderInbox(newInbox);
        }
      }
    );
  }

  unmount(): void {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this._inboxWatcher) {
      this._inboxWatcher();
      this._inboxWatcher = null;
    }
    this._refreshInFlight = false;
    if (this.view) {
      this.view.stopCountdown();
      this.view = null;
    }
  }

  onModuleDestroy(): void {
    this.unmount();
  }

  private handleActionError(err: unknown, actionName: string, fallbackToast?: string): void {
    if (ExtensionUtils.isContextInvalidated(err)) {
      this.unmount();
      return;
    }
    console.error(`[TempMailPopupController] ${actionName} error:`, err);
    if (fallbackToast) {
      this.view?.showToast(fallbackToast);
    }
  }

  private _bindViewEvents(): void {
    if (!this.view) return;

    this.view.on("generate_new", async () => {
      try {
        this.view?.setRefreshing(true);
        const email = await this.router.send<TempEmail>(TEMPMAIL_ACTIONS.GENERATE_NEW);
        const durationSec = (email?.durationMinutes ?? 60) * 60;
        this.view?.updateEmailCard(email, durationSec);
        this.view?.renderInbox([]);
        this.view?.showToast("Generated new address!");
      } catch (err) {
        this.handleActionError(err, "Generate", "Failed to generate address");
      } finally {
        this.view?.setRefreshing(false);
      }
    });

    this.view.on("refresh_inbox", async () => {
      await this.refreshInbox(true);
    });

    this.view.on("open_email", (email) => {
      this.view?.openModal(email as EmailMessage);
    });

    this.view.on("delete_email", async (messageId) => {
      try {
        await this.router.send(TEMPMAIL_ACTIONS.DELETE_MESSAGE, { messageId });
        this.view?.showToast("Message deleted");
        await this.refreshInbox(false);
      } catch (err) {
        this.handleActionError(err, "Delete");
      }
    });

    this.view.on("autofill_page", async () => {
      try {
        const success = await this.router.send(TEMPMAIL_ACTIONS.AUTOFILL_ACTIVE_TAB);
        if (success) {
          this.view?.showToast("Filled email into page!");
        } else {
          this.view?.showToast("No email field found on active tab");
        }
      } catch (err) {
        this.handleActionError(err, "Autofill", "Autofill failed");
      }
    });
  }

  async refreshState(): Promise<void> {
    if (!this.view) return;
    try {
      this.view.setRefreshing(true);
      const state = await this.router.send<TempMailCurrentState>(TEMPMAIL_ACTIONS.GET_CURRENT, {
        autoGenerate: true,
      });

      if (state?.email) {
        this.view.updateEmailCard(state.email, state.remainingSeconds);
      }
      await this.refreshInbox(false);
    } catch (err) {
      this.handleActionError(err, "Refresh state");
    } finally {
      this.view?.setRefreshing(false);
    }
  }

  async refreshInbox(showFeedback = false): Promise<void> {
    if (!this.view || this._refreshInFlight) return;
    this._refreshInFlight = true;
    try {
      if (showFeedback) this.view.setRefreshing(true);
      const res = await this.router.send<{ emails: EmailMessage[] }>(TEMPMAIL_ACTIONS.GET_INBOX, {
        refresh: true,
      });
      if (res && Array.isArray(res.emails)) {
        this.view.renderInbox(res.emails);
      }
      if (showFeedback) {
        this.view.showToast("Inbox refreshed");
      }
    } catch (err) {
      this.handleActionError(err, "Refresh inbox");
    } finally {
      this._refreshInFlight = false;
      if (showFeedback) this.view?.setRefreshing(false);
    }
  }
}
