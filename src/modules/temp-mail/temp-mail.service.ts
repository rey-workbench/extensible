import { EventBusService, StorageService, TimeUtils } from '@/core/index';
import { TEMPMAIL_CONFIG, TEMPMAIL_EVENTS, TEMPMAIL_STORAGE_KEYS } from '@/modules/temp-mail/constants/index';
import { CreateTempMailDto } from '@/modules/temp-mail/dto/create-temp-mail.dto';
import type { EmailMessage, TempEmail, TempMailCurrentState, TempMailSettings } from '@/modules/temp-mail/types/index';

/**
 * Service encapsulating TempMail API communications, state management, and business logic.
 */
export class TempMailService {
  static inject = [StorageService, EventBusService];

  private readonly apiBase = TEMPMAIL_CONFIG.API_BASE;
  public currentEmail: TempEmail | null = null;
  public emails: EmailMessage[] = [];
  public settings: TempMailSettings = {
    autoFillOnFocus: false,
    showFloatingButton: true,
    defaultDuration: TEMPMAIL_CONFIG.DEFAULT_DURATION
  };
  private isInitialized = false;

  constructor(
    private readonly storage: StorageService,
    private readonly eventBus: EventBusService
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.isInitialized) return;

    const savedState = await this.storage.get<TempEmail>(TEMPMAIL_STORAGE_KEYS.STATE, null);
    if (savedState && savedState.address) {
      const expires = new Date(savedState.expiresAt).getTime();
      if (Date.now() < expires) {
        this.currentEmail = savedState;
      }
    }

    const savedSettings = await this.storage.get<Partial<TempMailSettings>>(TEMPMAIL_STORAGE_KEYS.SETTINGS, null);
    if (savedSettings) {
      this.settings = { ...this.settings, ...savedSettings };
    }

    const savedInbox = await this.storage.get<EmailMessage[]>(TEMPMAIL_STORAGE_KEYS.INBOX_CACHE, []);
    if (Array.isArray(savedInbox)) {
      this.emails = savedInbox;
    }

    this.isInitialized = true;
  }

  hasValidEmail(): boolean {
    if (!this.currentEmail || !this.currentEmail.address) return false;
    const expires = new Date(this.currentEmail.expiresAt).getTime();
    return Date.now() < expires;
  }

  getRemainingSeconds(): number {
    if (!this.hasValidEmail() || !this.currentEmail) return 0;
    const expires = new Date(this.currentEmail.expiresAt).getTime();
    return Math.max(0, Math.floor((expires - Date.now()) / 1000));
  }

  get unreadCount(): number {
    return this.emails.filter((e) => !e.is_read).length;
  }

  getCurrentState(): TempMailCurrentState {
    return {
      email: this.currentEmail,
      remainingSeconds: this.getRemainingSeconds(),
      hasValidEmail: this.hasValidEmail(),
      unreadCount: this.unreadCount
    };
  }

  /**
   * Generate temporary email address with transient retry
   */
  async generateEmail(dto: CreateTempMailDto | { duration?: number } | null = null, retries = 2): Promise<TempEmail> {
    const validatedDto = dto instanceof CreateTempMailDto 
      ? dto 
      : new CreateTempMailDto({ duration: dto?.duration || this.settings.defaultDuration });

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          await TimeUtils.delay(1500 * attempt);
        }

        const response = await fetch(`${this.apiBase}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration: validatedDto.duration }),
          signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS)
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`TempMail API Error (${response.status}): ${errBody || response.statusText}`);
        }

        const data = await response.json();
        if (!data.success || !data.email) {
          throw new Error(data.error || 'Failed to generate email');
        }

        this.currentEmail = data.email as TempEmail;
        this.emails = [];

        await this.storage.set(TEMPMAIL_STORAGE_KEYS.STATE, this.currentEmail);
        await this.storage.set(TEMPMAIL_STORAGE_KEYS.INBOX_CACHE, this.emails);

        if (this.eventBus) {
          this.eventBus.emit(TEMPMAIL_EVENTS.EMAIL_GENERATED, this.currentEmail);
          this.eventBus.emit(TEMPMAIL_EVENTS.STATE_CHANGED, { email: this.currentEmail, emails: this.emails });
        }

        return this.currentEmail;
      } catch (err: unknown) {
        lastError = err;
        console.warn(`[TempMailService] generateEmail attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : String(err));
      }
    }

    throw lastError;
  }

  async fetchInbox(): Promise<EmailMessage[]> {
    if (!this.hasValidEmail() || !this.currentEmail) {
      return [];
    }

    const emailAddr = this.currentEmail.address;
    const url = `${this.apiBase}/api/emails/${encodeURIComponent(emailAddr)}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Inbox fetch error: HTTP ${response.status}`);
    }

    const data = await response.json();
    const fetched: EmailMessage[] = Array.isArray(data.emails) ? data.emails : [];

    const readIds = new Set(this.emails.filter((e) => e.is_read).map((e) => e.id));
    const merged: EmailMessage[] = fetched.map((item) => ({
      ...item,
      is_read: readIds.has(item.id) || !!item.is_read
    }));

    const previousCount = this.emails.length;
    this.emails = merged;
    await this.storage.set(TEMPMAIL_STORAGE_KEYS.INBOX_CACHE, this.emails);

    if (this.eventBus) {
      this.eventBus.emit(TEMPMAIL_EVENTS.INBOX_UPDATED, this.emails);
      if (merged.length > previousCount && merged[0]) {
        this.eventBus.emit(TEMPMAIL_EVENTS.NEW_MESSAGE_RECEIVED, merged[0]);
      }
    }

    return this.emails;
  }

  async deleteMessage(messageId: string | number): Promise<boolean> {
    if (!this.hasValidEmail() || !this.currentEmail) return false;

    const emailAddr = this.currentEmail.address;
    const url = `${this.apiBase}/api/emails/${encodeURIComponent(emailAddr)}/${encodeURIComponent(String(messageId))}`;

    try {
      await fetch(url, {
        method: 'DELETE',
        signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS)
      });
    } catch (e) {
      console.warn('[TempMailService] Server delete failed:', e);
    }

    this.emails = this.emails.filter((e) => String(e.id) !== String(messageId));
    await this.storage.set(TEMPMAIL_STORAGE_KEYS.INBOX_CACHE, this.emails);

    if (this.eventBus) {
      this.eventBus.emit(TEMPMAIL_EVENTS.INBOX_UPDATED, this.emails);
    }
    return true;
  }

  async markAsRead(messageId: string | number): Promise<void> {
    const target = this.emails.find((e) => String(e.id) === String(messageId));
    if (target) {
      target.is_read = true;
      await this.storage.set(TEMPMAIL_STORAGE_KEYS.INBOX_CACHE, this.emails);
      if (this.eventBus) {
        this.eventBus.emit(TEMPMAIL_EVENTS.INBOX_UPDATED, this.emails);
      }
    }
  }

  async updateSettings(newSettings: Partial<TempMailSettings>): Promise<TempMailSettings> {
    this.settings = { ...this.settings, ...newSettings };
    await this.storage.set(TEMPMAIL_STORAGE_KEYS.SETTINGS, this.settings);
    if (this.eventBus) {
      this.eventBus.emit(TEMPMAIL_EVENTS.SETTINGS_UPDATED, this.settings);
    }
    return this.settings;
  }
}

