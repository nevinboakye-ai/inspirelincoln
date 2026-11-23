/** Where a gallery photo lives: the uploader's own folder, a random name, WebP or JPEG. */
export const GALLERY_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|webp)$/;

/** The longest side of a saved photo, in pixels: sharp on a big screen, quick on a phone. */
export const GALLERY_MAX_SIDE = 2400;
/** The largest file the gallery folder takes (also set on the storage bucket). */
export const GALLERY_MAX_BYTES = 8 * 1024 * 1024;
/** The largest photo someone can pick before it's resized. */
export const GALLERY_MAX_PICK = 40 * 1024 * 1024;
/** How many photos can be added in one go. */
export const GALLERY_BATCH = 20;

/** The size a photo is saved at, keeping its shape, never enlarged. */
export function fitWithin(width: number, height: number, max = GALLERY_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The next and previous slide, wrapping round at either end. */
export function wrapIndex(i: number, length: number) {
  return length ? ((i % length) + length) % length : 0;
}

/** Whether a sideways drag was long and straight enough to count as a swipe: -1 next, 1 previous, 0 neither. */
export function swipeDirection(dx: number, dy: number, threshold = 48) {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? -1 : 1;
}
