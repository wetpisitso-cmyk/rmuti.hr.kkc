/**
 * Accept only official LINE add-friend short links from editable settings.
 * Never render untrusted schemes or lookalike hostnames.
 */
export function getLineOAUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 250) return null;
  try {
    const url = new URL(text);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "lin.ee" ||
      url.username || url.password || url.port || url.search || url.hash ||
      !/^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}
