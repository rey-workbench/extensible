export interface VideoEntry {
  id: string;

  title: string;
  author: string;
  addedAt: number;
}

export interface PlayerGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}
