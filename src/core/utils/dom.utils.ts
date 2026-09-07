import { StringUtils } from '@/core/utils/string.utils';

/**
 * Core DOM helpers for UI and Content Script operations.
 */
export class DomUtils {
  static escapeHtml(text: string | number | null | undefined): string {
    return StringUtils.escapeHtml(text);
  }

  static setInputValue(input: HTMLInputElement, value: string): void {
    if (!input) return;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    const inputEvent = new Event('input', { bubbles: true, composed: true });
    const changeEvent = new Event('change', { bubbles: true, composed: true });

    input.dispatchEvent(inputEvent);
    input.dispatchEvent(changeEvent);
  }
}
