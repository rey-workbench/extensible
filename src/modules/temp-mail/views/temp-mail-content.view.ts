import { DomUtils } from "@/core/index";
import { renderIcon } from "@/shared/index";

/**
 * View responsible for rendering in-field autofill badges and triggering synthetic events.
 */
interface ButtonBinding {
  btn: HTMLElement;
  input: HTMLInputElement;
  onPosition: () => void;
  observer: MutationObserver;
}

export class TempMailContentView {
  private readonly _activeButtons: HTMLElement[] = [];
  private readonly _bindings: ButtonBinding[] = [];
  private _injected = new WeakSet<HTMLInputElement>();
  private readonly SVG_MAIL_ICON = renderIcon("mail", 16);
  private readonly SVG_SPINNER_ICON = renderIcon("spinner", 16);
  private readonly SVG_CHECK_ICON = renderIcon("check", 16);

  hasButton(input: HTMLInputElement): boolean {
    return this._injected.has(input);
  }

  detachAll(): void {
    for (const b of this._bindings) {
      window.removeEventListener("scroll", b.onPosition);
      window.removeEventListener("resize", b.onPosition);
      b.observer.disconnect();
      b.btn.remove();
    }
    this._bindings.length = 0;
    this._activeButtons.length = 0;
    this._injected = new WeakSet<HTMLInputElement>();
  }

  attachButton(input: HTMLInputElement, onFillClick: () => Promise<string | null>): void {
    if (this._injected.has(input)) return;
    this._injected.add(input);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "aio-tempmail-btn";
    btn.innerHTML = `${this.SVG_MAIL_ICON}<span class="aio-tempmail-tooltip">Fill Temp Mail</span>`;
    btn.tabIndex = -1;
    this._activeButtons.push(btn);

    const updatePosition = () => {
      const rect = input.getBoundingClientRect();
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        window.getComputedStyle(input).display === "none"
      ) {
        btn.style.display = "none";
        return;
      }
      btn.style.display = "flex";
      btn.style.position = "fixed";
      btn.style.top = `${rect.top + rect.height / 2}px`;
      btn.style.left = `${rect.right - 28 - 8}px`;
      btn.style.zIndex = "var(--z-aio-base, 2147483640)";
    };

    updatePosition();
    document.body.appendChild(btn);

    window.addEventListener("scroll", updatePosition, { passive: true } as AddEventListenerOptions);
    window.addEventListener("resize", updatePosition, { passive: true } as AddEventListenerOptions);

    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.classList.add("aio-loading");
      btn.innerHTML = `${this.SVG_SPINNER_ICON}<span class="aio-tempmail-tooltip">Generating...</span>`;

      try {
        const email = await onFillClick();
        if (email) {
          this.fillInput(input, email);
          btn.innerHTML = `${this.SVG_CHECK_ICON}<span class="aio-tempmail-tooltip">Filled!</span>`;
          setTimeout(() => {
            btn.classList.remove("aio-loading");
            btn.innerHTML = `${this.SVG_MAIL_ICON}<span class="aio-tempmail-tooltip">Fill Temp Mail</span>`;
          }, 1500);
        }
      } catch (err) {
        console.error("[TempMailContentView] Autofill error:", err);
        btn.classList.remove("aio-loading");
        btn.innerHTML = `${this.SVG_MAIL_ICON}<span class="aio-tempmail-tooltip">Error</span>`;
      }
    });

    const observer = new MutationObserver(() => {
      if (!document.contains(input)) {
        window.removeEventListener("scroll", updatePosition);
        window.removeEventListener("resize", updatePosition);
        observer.disconnect();
        btn.remove();
        const idx = this._bindings.findIndex((b) => b.btn === btn);
        if (idx !== -1) this._bindings.splice(idx, 1);
        const aIdx = this._activeButtons.indexOf(btn);
        if (aIdx !== -1) this._activeButtons.splice(aIdx, 1);
        this._injected.delete(input);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    this._bindings.push({ btn, input, onPosition: updatePosition, observer });
  }

  fillInput(input: HTMLInputElement, email: string): void {
    DomUtils.setInputValue(input, email);
    input.classList.add("aio-tempmail-filled");
    setTimeout(() => {
      input.classList.remove("aio-tempmail-filled");
    }, 1200);
  }
}
