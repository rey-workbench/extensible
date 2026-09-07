import { DomUtils } from '@/core/index';

/**
 * View responsible for rendering in-field autofill badges and triggering synthetic events.
 */
export class TempMailContentView {
  private readonly _activeButtons: HTMLElement[] = [];
  private _injected = new WeakSet<HTMLInputElement>();
  private readonly SVG_MAIL_ICON = `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
  private readonly SVG_SPINNER_ICON = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>`;
  private readonly SVG_CHECK_ICON = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

  hasButton(input: HTMLInputElement): boolean {
    return this._injected.has(input);
  }

  detachAll(): void {
    for (const btn of this._activeButtons) {
      btn.remove();
    }
    this._activeButtons.length = 0;
    this._injected = new WeakSet<HTMLInputElement>();
  }

  attachButton(input: HTMLInputElement, onFillClick: () => Promise<string | null>): void {
    if (this._injected.has(input)) return;
    this._injected.add(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aio-tempmail-btn';
    btn.innerHTML = `${this.SVG_MAIL_ICON}<span class="aio-tempmail-tooltip">Fill Temp Mail</span>`;
    btn.tabIndex = -1;
    this._activeButtons.push(btn);

    const updatePosition = () => {
      const rect = input.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(input).display === 'none') {
        btn.style.display = 'none';
        return;
      }
      btn.style.display = 'flex';
      btn.style.position = 'fixed';
      btn.style.top = `${rect.top + rect.height / 2}px`;
      btn.style.left = `${rect.right - 28 - 8}px`;
      btn.style.zIndex = '2147483640';
    };

    updatePosition();
    document.body.appendChild(btn);

    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.classList.add('aio-loading');
      btn.innerHTML = `${this.SVG_SPINNER_ICON}<span class="aio-tempmail-tooltip">Generating...</span>`;

      try {
        const email = await onFillClick();
        if (email) {
          this.fillInput(input, email);
          btn.innerHTML = `${this.SVG_CHECK_ICON}<span class="aio-tempmail-tooltip">Filled!</span>`;
          setTimeout(() => {
            btn.classList.remove('aio-loading');
            btn.innerHTML = `${this.SVG_MAIL_ICON}<span class="aio-tempmail-tooltip">Fill Temp Mail</span>`;
          }, 1500);
        }
      } catch (err) {
        console.error('[TempMailContentView] Autofill error:', err);
        btn.classList.remove('aio-loading');
        btn.innerHTML = `${this.SVG_MAIL_ICON}<span class="aio-tempmail-tooltip">Error</span>`;
      }
    });

    const observer = new MutationObserver(() => {
      if (!document.contains(input)) {
        btn.remove();
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  fillInput(input: HTMLInputElement, email: string): void {
    DomUtils.setInputValue(input, email);
    input.classList.add('aio-tempmail-filled');
    setTimeout(() => {
      input.classList.remove('aio-tempmail-filled');
    }, 1200);
  }
}
