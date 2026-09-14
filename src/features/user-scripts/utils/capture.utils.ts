export function isUserScriptUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const base =
      typeof window !== "undefined" && window.location
        ? window.location.href
        : "https://example.com";
    const url = new URL(rawUrl, base);
    const path = url.pathname.toLowerCase();
    const href = url.href.toLowerCase();

    if (path.endsWith(".user.js") || href.includes(".user.js?") || href.includes(".user.js#")) {
      return true;
    }

    if (/(greasyfork|sleazyfork)\.org\/.*\/code\/.*\.user\.js/i.test(href)) {
      return true;
    }

    if (/openuserjs\.org\/install\/.*\.user\.js/i.test(href)) {
      return true;
    }

    if (
      (url.hostname === "raw.githubusercontent.com" ||
        url.hostname === "gist.githubusercontent.com") &&
      path.endsWith(".user.js")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
