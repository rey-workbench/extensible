/** Pure geometry helpers for placing the floating composer toolbar + menu. */

export interface DockPlacement {
  left: number;
  top: number;
  /** True when the dock sits below the composer instead of above it. */
  flipped?: boolean;
}

/** Clamps a number into [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Aligns the floating bar just above the composer (or below when no headroom). */
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

/** Places the export menu above the trigger, flipping below when out of headroom. */
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

/** Anchors a toast near the toolbar. */
export function computeToastPlacement(anchorRect: DOMRect): { bottom: number; left: number } {
  return {
    bottom: Math.max(12, window.innerHeight - anchorRect.top + 8),
    left: anchorRect.left + anchorRect.width / 2,
  };
}
