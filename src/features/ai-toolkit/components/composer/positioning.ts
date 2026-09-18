export interface DockPlacement {
  left: number;
  top: number;
  flipped?: boolean;
}

export interface DockRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

const DOCK_GAP = 6;

const MAX_ANCHOR_HEIGHT = 220;

const MAX_BOX_OFFSET = 60;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function resolveDockAnchor(box: DockRect, editor: DockRect | null): DockRect {
  const editorUsable =
    !!editor &&
    editor.width > 80 &&
    editor.height > 8 &&
    editor.top > -editor.height &&
    editor.top < window.innerHeight;

  if (!editorUsable) {
    return box;
  }

  const viewportWidth = window.innerWidth;
  const boxUnusable = box.height < 8 || box.height > MAX_ANCHOR_HEIGHT;

  const boxTooHigh = box.top < editor.top - MAX_BOX_OFFSET;
  const boxTooWide = box.width > Math.max(editor.width * 2.5, 900);
  const boxOffViewport = box.width > viewportWidth * 0.95;

  if (boxUnusable || boxTooHigh || boxTooWide || boxOffViewport) {
    return editor;
  }
  return box;
}

export function computeDockPlacement(
  composerRect: DockRect,
  dockWidth: number,
  dockHeight: number,
): DockPlacement {
  let left = composerRect.left + DOCK_GAP;
  left = clamp(left, 8, Math.max(8, window.innerWidth - dockWidth - 8));

  let top = composerRect.top - dockHeight - DOCK_GAP;
  const flipped = top < 8;
  if (flipped) top = composerRect.bottom + DOCK_GAP;

  return { left: Math.round(left), top: Math.round(top), flipped };
}

export function computeMenuPlacement(
  triggerRect: DOMRect,
  menuWidth: number,
  menuHeight: number,
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
