/**
 * True when this browser holds a Supabase sign-in cookie. It is only a hint:
 * the server still checks every request. Guests never download the sign-in
 * library, which keeps public pages light.
 */
export function hasSessionCookie() {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}
