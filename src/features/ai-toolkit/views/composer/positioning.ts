export interface DockPlacement {
  left: number;
  top: number;
  flipped?: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function computeDockPlacement(
  composerRect: DOMRect,
  dockWidth: number,
  dockHeight: number
): DockPlacement {
  let left = composerRect.left + 6;
  left = clamp(left, 8, window.innerWidth - dockWidth - 8);

  let top = composerRect.top - dockHeight - 6;
  const flipped = top < 8;
  if (flipped) top = composerRect.bottom + 6;

  return { left: Math.round(left), top: Math.round(top), flipped };
}

export function computeMenuPlacement(
  triggerRect: DOMRect,
  menuWidth: number,
  menuHeight: number
): { top: number; left: number } {
  let top = triggerRect.top - menuHeight - 8;
  if (top < 10) {
    top = triggerRect.bottom + 8;
  }

  let left = triggerRect.left;
  if (left + menuWidth > window.innerWidth - 12) {
    left = window.innerWidth - menuWidth - 12;
  }
  if (left < 12) {
    left = 12;
  }

  return { top: Math.round(top), left: Math.round(left) };
}
