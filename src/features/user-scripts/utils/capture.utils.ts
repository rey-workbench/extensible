export function isUserScriptUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    const path = url.pathname.toLowerCase();
    const href = url.href.toLowerCase();
    return path.endsWith(".user.js") || href.includes(".user.js?") || href.includes(".user.js#");
  } catch {
    return false;
  }
}
