import { type ExecutionContext, MessageRouterService, StorageService } from "@/core/index";
import { TEMPMAIL_ACTIONS, TEMPMAIL_STORAGE_KEYS } from "@/modules/temp-mail/constants/index";
import type {
  TempEmail,
  TempMailCurrentState,
  TempMailSettings,
} from "@/modules/temp-mail/types/index";
import { TempMailUtils } from "@/modules/temp-mail/utils/index";
import { TempMailContentView } from "@/modules/temp-mail/views/temp-mail-content.view";

/**
 * Controller managing TempMail features inside the Content Script context.
 */
export class TempMailContentController {
  public static readonly contextType: ExecutionContext = "content";
  public static readonly inject = [MessageRouterService, StorageService] as const;

  public readonly view = new TempMailContentView();
  private observer: MutationObserver | null = null;
  private unwatchSettings: (() => void) | null = null;
  private settings: TempMailSettings = {
    autoFillOnFocus: false,
    showFloatingButton: true,
    defaultDuration: 60,
  };

  constructor(
    private readonly router: MessageRouterService,
    private readonly storage: StorageService
  ) {}

  async onModuleInit(): Promise<void> {
    await this._loadSettings();
    this._watchSettings();
    this._registerRoutes();
    this._scanAndAttach();
    this._startObserving();
  }

  onModuleDestroy(): void {
    if (this.unwatchSettings) {
      this.unwatchSettings();
      this.unwatchSettings = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.view.detachAll();
  }

  private async _loadSettings(): Promise<void> {
    const saved = await this.storage.get<Partial<TempMailSettings>>(
      TEMPMAIL_STORAGE_KEYS.SETTINGS,
      null
    );
    if (saved) {
      this.settings = { ...this.settings, ...saved };
    }
  }

  private _watchSettings(): void {
    this.unwatchSettings = this.storage.watch<Partial<TempMailSettings>>(
      TEMPMAIL_STORAGE_KEYS.SETTINGS,
      (newSettings) => {
        if (!newSettings) return;
        const prevShow = this.settings.showFloatingButton;
        this.settings = { ...this.settings, ...newSettings };

        if (prevShow !== this.settings.showFloatingButton) {
          if (this.settings.showFloatingButton) {
            this._scanAndAttach();
          } else {
            this.view.detachAll();
          }
        }
      }
    );
  }

  private _registerRoutes(): void {
    this.router.subscribe(TEMPMAIL_ACTIONS.AUTOFILL_EMAIL, (payload: { email?: string }) => {
      const email = payload?.email;
      if (!email) return false;

      const activeEl = document.activeElement;
      if (activeEl && TempMailUtils.isEmailField(activeEl)) {
        this.view.fillInput(activeEl as HTMLInputElement, email);
        return true;
      }

      const inputs = document.querySelectorAll("input");
      for (const input of inputs) {
        if (TempMailUtils.isEmailField(input)) {
          this.view.fillInput(input, email);
          return true;
        }
      }
      return false;
    });
  }

  private _scanAndAttach(): void {
    if (!this.settings.showFloatingButton) return;

    const inputs = document.querySelectorAll("input");
    for (const input of inputs) {
      if (TempMailUtils.isEmailField(input)) {
        this._attachToInput(input);
      }
    }
  }

  private _attachToInput(input: HTMLInputElement): void {
    if (this.settings.showFloatingButton && !this.view.hasButton(input)) {
      this.view.attachButton(input, async () => {
        const res = await this.router.send<TempMailCurrentState | TempEmail | null>(
          TEMPMAIL_ACTIONS.GET_CURRENT,
          {
            autoGenerate: true,
          }
        );
        // Handler returns bare TempEmail on auto-generate, state object otherwise
        if (!res) return null;
        return "email" in res ? (res.email?.address ?? null) : (res.address ?? null);
      });
    }

    if (this.settings.autoFillOnFocus) {
      input.addEventListener(
        "focus",
        async () => {
          if (!input.value) {
            const res = await this.router.send<TempMailCurrentState | TempEmail | null>(
              TEMPMAIL_ACTIONS.GET_CURRENT,
              {
                autoGenerate: true,
              }
            );
            const email = !res ? null : "email" in res ? res.email : res;
            if (email?.address && !input.value) {
              this.view.fillInput(input, email.address);
            }
          }
        },
        { once: true }
      );
    }
  }

  private _startObserving(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as HTMLElement;

          if (el.tagName === "INPUT" && TempMailUtils.isEmailField(el)) {
            this._attachToInput(el as HTMLInputElement);
          } else if (el.querySelectorAll) {
            const nested = el.querySelectorAll("input");
            for (const input of nested) {
              if (TempMailUtils.isEmailField(input)) {
                this._attachToInput(input);
              }
            }
          }
        }
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }
}
