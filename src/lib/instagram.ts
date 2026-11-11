/** Instagram usernames: letters, numbers, full stops and underscores, up to 30 characters. */
export const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Accepts what people paste: "@name", "name", "instagram.com/name" or a full
 * profile link. Returns the bare username, "" for blank, or null if it isn't one.
 */
export function cleanInstagram(raw: string): string | null {
  let v = raw.trim();
  if (!v) return "";
  const link = v.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)\/?(?:[?#].*)?$/i);
  if (link) v = link[1];
  v = v.replace(/^@/, "");
  return INSTAGRAM_HANDLE.test(v) && !/^\.|\.$|\.\./.test(v) ? v : null;
}

export const instagramUrl = (handle: string) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;
