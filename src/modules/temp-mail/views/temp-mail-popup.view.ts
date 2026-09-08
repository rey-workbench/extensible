import { ExtensionUtils, TimeUtils, escapeHtml } from '@/core/index';
import { TempMailUtils } from '@/modules/temp-mail/utils/index';
import type { EmailMessage, TempEmail } from '@/modules/temp-mail/types/index';
import {
  renderButton,
  renderIconButton,
  renderBadge,
  renderStatusIndicator,
  renderCountdown,
  renderCopyInput,
  renderSectionHeader,
  renderEmptyState,
  renderModal
} from '@/shared/index';

const SVG_NEW_ADDRESS = `<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
const SVG_AUTOFILL = `<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/></svg>`;
const SVG_REFRESH_ICON = `<svg viewBox="0 0 24 24" id="tmRefreshIcon"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
const SVG_MAIL_ICON = `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;

/**
 * View responsible for rendering and managing TempMail UI within the Extension Popup.
 * Aligned with the Extensity Home design system and utilizing shared reusable components.
 */
export class TempMailPopupView {
  private _countdownInterval: NodeJS.Timeout | null = null;
  private readonly _eventHandlers: Record<string, (data?: any) => void> = {};

  private emailInput!: HTMLInputElement;
  private copyBtn!: HTMLButtonElement;
  private generateBtn!: HTMLButtonElement;
  private autofillBtn!: HTMLButtonElement;
  private refreshBtn!: HTMLButtonElement;
  private refreshIcon!: HTMLElement;
  private countdownEl!: HTMLElement;
  private statusDot!: HTMLElement;
  private statusText!: HTMLElement;
  private emailsList!: HTMLElement;
  private emailCountBadge!: HTMLElement;
  
  private modal!: HTMLElement;
  private modalCloseBtn!: HTMLButtonElement;
  private modalSubject!: HTMLElement;
  private modalFrom!: HTMLElement;
  private modalDate!: HTMLElement;
  private modalBody!: HTMLElement;
  private modalDeleteBtn!: HTMLButtonElement;
  private otpCard!: HTMLElement;
  private otpCode!: HTMLElement;
  private otpCopyBtn!: HTMLButtonElement;
  private toast!: HTMLElement;

  constructor(public readonly container: HTMLElement) {}

  on(event: string, handler: (data?: any) => void): void {
    this._eventHandlers[event] = handler;
  }

  private _emit(event: string, data?: any): void {
    if (this._eventHandlers[event]) {
      this._eventHandlers[event](data);
    }
  }

  renderLayout(): void {
    const statusIndicatorHtml = renderStatusIndicator({
      id: 'tmStatus',
      active: true,
      label: 'Active'
    });

    const countdownHtml = renderCountdown({
      id: 'tmCountdown',
      value: '--:--'
    });

    const copyInputHtml = renderCopyInput({
      id: 'tmEmailInput',
      buttonId: 'tmCopyBtn',
      value: 'Loading...',
      readOnly: true,
      buttonTitle: 'Copy Address'
    });

    const generateBtnHtml = renderButton({
      id: 'tmGenerateBtn',
      variant: 'primary',
      icon: SVG_NEW_ADDRESS,
      text: 'New Address',
      title: 'Generate new address'
    });

    const autofillBtnHtml = renderButton({
      id: 'tmAutofillBtn',
      variant: 'secondary',
      icon: SVG_AUTOFILL,
      text: 'Autofill Page',
      title: 'Fill into active tab'
    });

    const sectionHeaderHtml = renderSectionHeader('Inbox', {
      badge: renderBadge({ id: 'tmEmailCount', text: '0', variant: 'primary' }),
      action: renderIconButton({
        id: 'tmRefreshBtn',
        icon: SVG_REFRESH_ICON,
        title: 'Refresh Inbox',
        variant: 'ghost'
      })
    });

    const modalHtml = renderModal({
      id: 'tmReaderModal',
      title: '(No Subject)',
      contentHtml: `
        <div class="tm-modal-meta">
          <div class="tm-meta-row">
            <span class="tm-meta-label">From:</span>
            <span class="tm-meta-val" id="tmModalFrom"></span>
          </div>
          <div class="tm-meta-row">
            <span class="tm-meta-label">Date:</span>
            <span class="tm-meta-val" id="tmModalDate"></span>
          </div>
        </div>

        <div class="tm-otp-card" id="tmOtpCard" style="display: none;">
          <span class="tm-otp-label">Verification Code:</span>
          <span class="tm-otp-code" id="tmOtpCode"></span>
          ${renderButton({ id: 'tmOtpCopyBtn', variant: 'secondary', size: 'sm', text: 'Copy Code' })}
        </div>

        <div class="tm-modal-body-container" id="tmModalBody"></div>
      `,
      footerHtml: `
        ${renderButton({ id: 'tmModalDeleteBtn', variant: 'danger', size: 'sm', text: 'Delete Message' })}
      `
    });

    this.container.innerHTML = `
      <div class="tm-module">
        <div class="ext-card tm-email-card">
          <div class="ext-card-header">
            ${statusIndicatorHtml}
            ${countdownHtml}
          </div>

          ${copyInputHtml}

          <div class="ext-btn-group">
            ${generateBtnHtml}
            ${autofillBtnHtml}
          </div>
        </div>

        <div class="tm-inbox-section">
          ${sectionHeaderHtml}
          <div class="tm-emails-list ext-list" id="tmEmailsList"></div>
        </div>

        ${modalHtml}

        <div class="ext-toast" id="tmToast"></div>
      </div>
    `;

    this._bindLayoutEvents();
  }

  private _bindLayoutEvents(): void {
    this.emailInput = this.container.querySelector('#tmEmailInput')!;
    this.copyBtn = this.container.querySelector('#tmCopyBtn')!;
    this.generateBtn = this.container.querySelector('#tmGenerateBtn')!;
    this.autofillBtn = this.container.querySelector('#tmAutofillBtn')!;
    this.refreshBtn = this.container.querySelector('#tmRefreshBtn')!;
    this.refreshIcon = this.container.querySelector('#tmRefreshIcon')!;
    this.countdownEl = this.container.querySelector('#tmCountdown')!;
    this.statusDot = this.container.querySelector('#tmStatusDot')!;
    this.statusText = this.container.querySelector('#tmStatusText')!;
    this.emailsList = this.container.querySelector('#tmEmailsList')!;
    this.emailCountBadge = this.container.querySelector('#tmEmailCount')!;

    this.modal = this.container.querySelector('#tmReaderModal')!;
    this.modalCloseBtn = this.container.querySelector('#tmReaderModalCloseBtn')!;
    this.modalSubject = this.container.querySelector('#tmReaderModalTitle')!;
    this.modalFrom = this.container.querySelector('#tmModalFrom')!;
    this.modalDate = this.container.querySelector('#tmModalDate')!;
    this.modalBody = this.container.querySelector('#tmModalBody')!;
    this.modalDeleteBtn = this.container.querySelector('#tmModalDeleteBtn')!;
    this.otpCard = this.container.querySelector('#tmOtpCard')!;
    this.otpCode = this.container.querySelector('#tmOtpCode')!;
    this.otpCopyBtn = this.container.querySelector('#tmOtpCopyBtn')!;
    this.toast = this.container.querySelector('#tmToast')!;

    this.copyBtn.addEventListener('click', async () => {
      if (this.emailInput.value && this.emailInput.value !== 'Loading...' && this.emailInput.value !== 'No active address') {
        const ok = await ExtensionUtils.copyToClipboard(this.emailInput.value);
        if (ok) this.showToast('Copied to clipboard!');
      }
    });

    this.generateBtn.addEventListener('click', () => this._emit('generate_new'));
    this.autofillBtn.addEventListener('click', () => this._emit('autofill_page'));
    this.refreshBtn.addEventListener('click', () => this._emit('refresh_inbox'));
    this.modalCloseBtn.addEventListener('click', () => this.closeModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });

    this.otpCopyBtn.addEventListener('click', async () => {
      if (this.otpCode.textContent) {
        const ok = await ExtensionUtils.copyToClipboard(this.otpCode.textContent);
        if (ok) this.showToast('Verification code copied!');
      }
    });

    this.modalDeleteBtn.addEventListener('click', () => {
      const emailId = this.modalDeleteBtn.dataset.emailId;
      if (emailId) {
        this._emit('delete_email', emailId);
        this.closeModal();
      }
    });
  }

  updateEmailCard(email: TempEmail | null, remainingSeconds: number): void {
    if (!email || remainingSeconds <= 0) {
      this.emailInput.value = 'No active address';
      this.statusDot.className = 'ext-status-dot expired';
      this.statusText.textContent = 'Expired';
      this.countdownEl.textContent = '00:00';
      this.stopCountdown();
      return;
    }

    this.emailInput.value = email.address;
    this.statusDot.className = 'ext-status-dot active';
    this.statusText.textContent = 'Active';

    this.startCountdown(remainingSeconds);
  }

  startCountdown(seconds: number): void {
    this.stopCountdown();
    let remaining = seconds;
    this.countdownEl.textContent = TempMailUtils.formatCountdown(remaining);

    this._countdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        this.countdownEl.textContent = '00:00';
        this.statusDot.className = 'ext-status-dot expired';
        this.statusText.textContent = 'Expired';
        this.stopCountdown();
      } else {
        this.countdownEl.textContent = TempMailUtils.formatCountdown(remaining);
      }
    }, 1000);
  }

  stopCountdown(): void {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  renderInbox(emails: EmailMessage[]): void {
    this.emailCountBadge.textContent = String(emails.length);

    if (emails.length === 0) {
      this.emailsList.innerHTML = renderEmptyState({
        icon: SVG_MAIL_ICON,
        title: 'Inbox is currently empty',
        subtitle: 'Waiting for incoming messages...'
      });
      return;
    }

    this.emailsList.innerHTML = emails.map((item) => `
      <div class="ext-item tm-email-item ${item.is_read ? 'read' : 'unread'}" data-id="${escapeHtml(item.id)}">
        <div class="ext-item-icon">
          ${SVG_MAIL_ICON}
        </div>
        <div class="ext-item-info">
          <div class="ext-item-title">${escapeHtml(item.from_address || 'Unknown')}</div>
          <div class="ext-item-subtitle">${escapeHtml(item.subject || '(No Subject)')}</div>
        </div>
        <div class="ext-item-actions">
          <span class="tm-item-time">${TimeUtils.formatRelativeTime(item.received_at)}</span>
        </div>
      </div>
    `).join('');

    this.emailsList.querySelectorAll('.tm-email-item').forEach((row) => {
      row.addEventListener('click', () => {
        const id = (row as HTMLElement).dataset.id;
        const target = emails.find((e) => String(e.id) === String(id));
        if (target) {
          this._emit('open_email', target);
        }
      });
    });
  }

  openModal(email: EmailMessage): void {
    this.modalSubject.textContent = email.subject || '(No Subject)';
    this.modalFrom.textContent = email.from_address || 'Unknown';
    this.modalDate.textContent = new Date(email.received_at).toLocaleString();
    this.modalDeleteBtn.dataset.emailId = String(email.id);

    const code = TempMailUtils.extractOtpCode((email.subject || '') + ' ' + (email.content || ''));
    if (code) {
      this.otpCode.textContent = code;
      this.otpCard.style.display = 'flex';
    } else {
      this.otpCard.style.display = 'none';
    }

    const content = email.content || '<p style="color:#64748b;">(Empty email content)</p>';
    this.modalBody.innerHTML = '';

    const frame = document.createElement('iframe');
    frame.id = 'tmModalFrame';
    frame.className = 'tm-body-frame';
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    frame.srcdoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data:;">
        <base target="_blank">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.45; color: #202124; margin: 8px; word-break: break-word; }
          img { max-width: 100%; height: auto; }
          a { color: #2563eb; text-decoration: underline; cursor: pointer; }
          a:hover { color: #1d4ed8; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `;
    this.modalBody.appendChild(frame);

    this.modal.style.display = 'flex';
  }

  closeModal(): void {
    this.modal.style.display = 'none';
    if (this.modalBody) {
      this.modalBody.innerHTML = '';
    }
  }

  setRefreshing(loading: boolean): void {
    if (loading) {
      this.refreshIcon.classList.add('spinning');
    } else {
      this.refreshIcon.classList.remove('spinning');
    }
  }

  showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    setTimeout(() => {
      this.toast.classList.remove('visible');
    }, 2000);
  }
}
