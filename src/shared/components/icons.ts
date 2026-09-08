/**
 * Standardized SVG Icon System for UI Consistency and Zero Duplication.
 */

export type IconName =
  | "copy"
  | "check"
  | "trash"
  | "mail"
  | "refresh"
  | "download"
  | "markdown"
  | "pdf"
  | "json"
  | "html"
  | "flame"
  | "close"
  | "caret"
  | "plus"
  | "search"
  | "autofill"
  | "spinner";

const ICON_PATHS: Record<Exclude<IconName, "spinner">, string> = {
  copy: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  mail: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  refresh:
    "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  markdown:
    "M20.5 3H3.5A2.5 2.5 0 001 5.5v13A2.5 2.5 0 003.5 21h17a2.5 2.5 0 002.5-2.5v-13A2.5 2.5 0 0020.5 3zm-9 12h-2v-4.5L7.75 12l-1.75-1.5V15h-2V9h2l1.75 1.5L9.5 9h2v6zm6.5 0l-3-3h2V9h2v3h2l-3 3z",
  pdf: "M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z",
  json: "M5 3h2v2H5v5a2 2 0 01-2 2 2 2 0 012 2v5h2v2H5c-1.1 0-2-.9-2-2v-4a2 2 0 00-2-2 2 2 0 002-2V5c0-1.1.9-2 2-2zm14 0c1.1 0 2 .9 2 2v4a2 2 0 002 2 2 2 0 00-2 2v4c0 1.1-.9 2-2 2h-2v-2h2v-5a2 2 0 012-2 2 2 0 01-2-2V5h-2V3h2z",
  html: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",
  flame:
    "M12 23c-4.97 0-9-4.03-9-9 0-3.32 1.8-6.19 4.47-7.68.27-.15.61-.13.86.06.25.18.36.49.28.79-.44 1.76-.04 3.71 1.09 5.09.17.21.43.32.7.3.27-.02.51-.17.63-.41.86-1.74 2.38-3.05 4.19-3.76.3-.12.64-.04.86.2.22.24.26.59.1.87-1.12 1.95-1.16 4.35-.12 6.34.14.26.4.42.7.42.06 0 .12 0 .18-.02.35-.08.6-.37.6-.73 0-2.3 1.15-4.46 3.09-5.78.28-.19.65-.18.91.03.26.21.35.56.23.88C20.67 13.91 21 15.42 21 17c0 3.31-2.69 6-6 6z",
  close:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  caret: "M7 10l5 5 5-5z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  search:
    "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  autofill:
    "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z",
};

export function renderIcon(name: IconName, size = 16, className = "", id = "", style = ""): string {
  const classAttr = className ? ` class="${className}"` : "";
  const idAttr = id ? ` id="${id}"` : "";
  const styleAttr = style ? ` style="${style}"` : "";

  if (name === "spinner") {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"${classAttr}${idAttr}${styleAttr}><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>`;
  }

  const path = ICON_PATHS[name] || "";
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"${classAttr}${idAttr}${styleAttr}><path d="${path}"/></svg>`;
}
