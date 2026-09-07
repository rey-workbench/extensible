import { ExtensionUtils, MessageRouterService, type ExecutionContext } from '@/core/index';
import { CONTENT_ACTIONS } from '@/shared/index';
import { TEMPMAIL_ACTIONS } from '@/modules/temp-mail/constants/index';
import type { TempEmail } from '@/modules/temp-mail/types/index';
import { TempMailPopupView } from '@/modules/temp-mail/views/temp-mail-popup.view';

/**
 * Controller mediating between Popup View and extension services.
 * Implements the standard mount(container) and unmount() contract for the PopupShell.
 */
export class TempMailPopupController {
  static contextType: ExecutionContext = 'popup';
  static inject = [MessageRouterService];

  public view: TempMailPopupView | null = null;
  private _pollInterval: NodeJS.Timeout | null = null;

  constructor(private readonly router: MessageRouterService) {}

  async mount(container: HTMLElement): Promise<void> {
    this.view = new TempMailPopupView(container);
    this.view.renderLayout();
    this._bindViewEvents();
    await this.refreshState();

    this._pollInterval = setInterval(async () => {
      await this.refreshInbox(false);
    }, 5000);
  }

  unmount(): void {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this.view) {
      this.view.stopCountdown();
      this.view = null;
    }
  }

  onModuleDestroy(): void {
    this.unmount();
  }

  private _bindViewEvents(): void {
    if (!this.view) return;

    this.view.on('generate_new', async () => {
      try {
        this.view?.setRefreshing(true);
        const email = await this.router.send<TempEmail>(TEMPMAIL_ACTIONS.GENERATE_NEW);
        const durationSec = (email?.durationMinutes ?? 60) * 60;
        this.view?.updateEmailCard(email, durationSec);
        this.view?.renderInbox([]);
        this.view?.showToast('Generated new address!');
      } catch (err) {
        if (ExtensionUtils.isContextInvalidated(err)) {
          this.unmount();
          return;
        }
        console.error('[TempMailPopupController] Generate error:', err);
        this.view?.showToast('Failed to generate address');
      } finally {
        this.view?.setRefreshing(false);
      }
    });

    this.view.on('refresh_inbox', async () => {
      await this.refreshInbox(true);
    });

    this.view.on('open_email', (email) => {
      this.view?.openModal(email);
    });

    this.view.on('delete_email', async (messageId) => {
      try {
        await this.router.send(TEMPMAIL_ACTIONS.DELETE_MESSAGE, { messageId });
        this.view?.showToast('Message deleted');
        await this.refreshInbox(false);
      } catch (err) {
        if (ExtensionUtils.isContextInvalidated(err)) {
          this.unmount();
          return;
        }
        console.error('[TempMailPopupController] Delete error:', err);
      }
    });

    this.view.on('autofill_page', async () => {
      try {
        const success = await this.router.send(TEMPMAIL_ACTIONS.AUTOFILL_ACTIVE_TAB);
        if (success) {
          this.view?.showToast('Filled email into page!');
        } else {
          this.view?.showToast('No email field found on active tab');
        }
      } catch (err) {
        if (ExtensionUtils.isContextInvalidated(err)) {
          this.unmount();
          return;
        }
        console.error('[TempMailPopupController] Autofill error:', err);
        this.view?.showToast('Autofill failed');
      }
    });
  }

  async refreshState(): Promise<void> {
    if (!this.view) return;
    try {
      this.view.setRefreshing(true);
      const res = await this.router.send<any>(TEMPMAIL_ACTIONS.GET_CURRENT, { autoGenerate: true });
      const email = res?.email || res;
      const remainingSeconds = res?.remainingSeconds ?? ((email?.durationMinutes ?? 0) * 60);

      this.view.updateEmailCard(email, remainingSeconds);
      await this.refreshInbox(false);
    } catch (err) {
      if (ExtensionUtils.isContextInvalidated(err)) {
        this.unmount();
        return;
      }
      console.error('[TempMailPopupController] Refresh state failed:', err);
    } finally {
      this.view?.setRefreshing(false);
    }
  }

  async refreshInbox(showFeedback = false): Promise<void> {
    if (!this.view) return;
    try {
      if (showFeedback) this.view.setRefreshing(true);
      const res = await this.router.send<any>(TEMPMAIL_ACTIONS.GET_INBOX, { refresh: true });
      if (res && Array.isArray(res.emails)) {
        this.view.renderInbox(res.emails);
      }
      if (showFeedback) {
        this.view.showToast('Inbox refreshed');
      }
    } catch (err) {
      if (ExtensionUtils.isContextInvalidated(err)) {
        this.unmount();
        return;
      }
      console.error('[TempMailPopupController] Refresh inbox failed:', err);
    } finally {
      if (showFeedback) this.view?.setRefreshing(false);
    }
  }
}
