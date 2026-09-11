import { showToast } from "@/lib/toast";

export function showComposerToast(anchor: HTMLElement, message: string, isError = false): void {
  showToast(anchor, message, { isError, anchor });
}
