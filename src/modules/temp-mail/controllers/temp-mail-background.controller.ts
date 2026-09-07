import { EventBusService, ExtensionUtils, MessageRouterService, type ExecutionContext } from '@/core/index';
import { CONTENT_ACTIONS } from '@/shared/index';
import { TEMPMAIL_ACTIONS, TEMPMAIL_CONFIG, TEMPMAIL_EVENTS } from '@/modules/temp-mail/constants/index';
import type { EmailMessage } from '@/modules/temp-mail/types/index';
import { TempMailService } from '@/modules/temp-mail/temp-mail.service';

/**
 * Controller handling Background Service Worker message patterns, alarms, and context menus.
 */
export class TempMailBackgroundController {
  static contextType: ExecutionContext = 'background';
  static inject = [TempMailService, MessageRouterService, EventBusService];

  private readonly alarmName = 'aio_tempmail_poll_alarm';

  constructor(
    private readonly tempMailService: TempMailService,
    private readonly router: MessageRouterService,
    private readonly eventBus: EventBusService
  ) {}

  async onModuleInit(): Promise<void> {
    this._registerRoutes();
    this._setupAlarms();
    this._setupContextMenus();
    this._bindEvents();
    await this._updateBadge();
  }

  async onModuleDestroy(): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      await chrome.alarms.clear(this.alarmName);
    }
  }

  private _registerRoutes(): void {
    this.router.subscribe(TEMPMAIL_ACTIONS.GET_CURRENT, async (payload: { autoGenerate?: boolean; duration?: number }) => {
      await this.tempMailService.onModuleInit();
      if (!this.tempMailService.hasValidEmail() && payload?.autoGenerate) {
        return await this.tempMailService.generateEmail({ duration: payload?.duration });
      }
      return {
        email: this.tempMailService.currentEmail,
        remainingSeconds: this.tempMailService.getRemainingSeconds(),
        hasValidEmail: this.tempMailService.hasValidEmail(),
        unreadCount: this.tempMailService.emails.filter((e) => !e.is_read).length
      };
    });

    this.router.subscribe(TEMPMAIL_ACTIONS.GENERATE_NEW, async (payload: { duration?: number }) => {
      const email = await this.tempMailService.generateEmail({ duration: payload?.duration });
      await this._updateBadge();
      return email;
    });

    this.router.subscribe(TEMPMAIL_ACTIONS.GET_INBOX, async (payload: { refresh?: boolean }) => {
      if (payload?.refresh) {
        await this.tempMailService.fetchInbox();
        await this._updateBadge();
      }
      return {
        emails: this.tempMailService.emails,
        remainingSeconds: this.tempMailService.getRemainingSeconds(),
        currentEmail: this.tempMailService.currentEmail
      };
    });

    this.router.subscribe(TEMPMAIL_ACTIONS.DELETE_MESSAGE, async (payload: { messageId: string | number }) => {
      if (!payload?.messageId) throw new Error('Missing messageId');
      const result = await this.tempMailService.deleteMessage(payload.messageId);
      await this._updateBadge();
      return result;
    });

    this.router.subscribe(TEMPMAIL_ACTIONS.UPDATE_SETTINGS, async (payload: any) => {
      return await this.tempMailService.updateSettings(payload);
    });

    this.router.subscribe(TEMPMAIL_ACTIONS.AUTOFILL_ACTIVE_TAB, async () => {
      return await this._fillCurrentActiveTab();
    });
  }

  private _setupAlarms(): void {
    if (typeof chrome === 'undefined' || !chrome.alarms) return;

    chrome.alarms.create(this.alarmName, {
      periodInMinutes: TEMPMAIL_CONFIG.POLL_INTERVAL_SEC / 60
    });

    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === this.alarmName && this.tempMailService.hasValidEmail()) {
        try {
          await this.tempMailService.fetchInbox();
          await this._updateBadge();
        } catch (e) {
          console.debug('[TempMailBackgroundController] Poll tick:', e);
        }
      }
    });
  }

  private _setupContextMenus(): void {
    if (typeof chrome === 'undefined' || !chrome.contextMenus) return;

    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'aio_tempmail_root',
        title: 'Temp Mail',
        contexts: ['editable', 'page']
      });

      chrome.contextMenus.create({
        id: 'aio_tempmail_fill',
        parentId: 'aio_tempmail_root',
        title: 'Fill with Temp Mail',
        contexts: ['editable']
      });

      chrome.contextMenus.create({
        id: 'aio_tempmail_copy',
        parentId: 'aio_tempmail_root',
        title: 'Copy Active Temp Mail',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'aio_tempmail_new',
        parentId: 'aio_tempmail_root',
        title: 'Generate Fresh Email',
        contexts: ['all']
      });
    });

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (!tab?.id) return;

      if (info.menuItemId === 'aio_tempmail_fill') {
        await this._fillCurrentActiveTab(tab.id);
      } else if (info.menuItemId === 'aio_tempmail_copy') {
        const email = this.tempMailService.hasValidEmail()
          ? this.tempMailService.currentEmail!.address
          : (await this.tempMailService.generateEmail()).address;

        chrome.scripting?.executeScript({
          target: { tabId: tab.id },
          func: (text: string) => navigator.clipboard.writeText(text),
          args: [email]
        });
      } else if (info.menuItemId === 'aio_tempmail_new') {
        await this.tempMailService.generateEmail();
        await this._updateBadge();
      }
    });
  }

  private _bindEvents(): void {
    this.eventBus.on(TEMPMAIL_EVENTS.INBOX_UPDATED, async () => {
      await this._updateBadge();
    });

    this.eventBus.on<EmailMessage>(TEMPMAIL_EVENTS.NEW_MESSAGE_RECEIVED, (message) => {
      ExtensionUtils.showNotification({
        title: `New Email: ${message.from_address || 'TempMail'}`,
        message: message.subject || '(No Subject)',
        priority: 2
      });
    });
  }

  private async _updateBadge(): Promise<void> {
    if (!this.tempMailService.hasValidEmail()) {
      await ExtensionUtils.clearBadge();
      return;
    }

    const unread = this.tempMailService.emails.filter((e) => !e.is_read).length;
    if (unread > 0) {
      await ExtensionUtils.setBadge(String(unread), '#10b981');
    } else {
      await ExtensionUtils.clearBadge();
    }
  }

  private async _fillCurrentActiveTab(targetTabId: number | null = null): Promise<boolean> {
    let emailAddress = '';
    if (this.tempMailService.hasValidEmail()) {
      emailAddress = this.tempMailService.currentEmail!.address;
    } else {
      const gen = await this.tempMailService.generateEmail();
      emailAddress = gen.address;
    }

    try {
      if (targetTabId) {
        await this.router.sendToTab(targetTabId, CONTENT_ACTIONS.AUTOFILL_EMAIL, {
          email: emailAddress
        });
      } else {
        await this.router.sendToActiveTab(CONTENT_ACTIONS.AUTOFILL_EMAIL, {
          email: emailAddress
        });
      }
      return true;
    } catch (err) {
      console.warn('[TempMailBackgroundController] Tab autofill message failed:', err);
      return false;
    }
  }
}

