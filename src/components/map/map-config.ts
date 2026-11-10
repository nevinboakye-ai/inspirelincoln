/**
 * Shared map settings. The public campus map draws its own campus from a file
 * on this site (see campus-layer.ts). These CARTO tiles, built on OpenStreetMap
 * data, are only used by the committee's location picker and as a fallback if
 * that file can't load.
 */
export const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Centre of the Brayford Pool campus, between the buildings with known locations. */
export const CAMPUS_CENTRE: [number, number] = [53.2279, -0.5495];
export const CAMPUS_ZOOM = 17;

/** Walking pace used for rough time estimates: about 4.8 km/h. */
export const WALK_METRES_PER_MINUTE = 80;

export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function walkingMinutes(metres: number) {
  return Math.max(1, Math.round(metres / WALK_METRES_PER_MINUTE));
}

/** A link to walking directions in the visitor's own maps app. */
export function directionsUrl(place: { name: string; lat: number | null; lng: number | null }, app: "google" | "apple" = "google") {
  const query = place.lat != null && place.lng != null ? `${place.lat},${place.lng}` : `${place.name}, University of Lincoln, Brayford Pool, Lincoln LN6 7TS`;
  if (app === "apple") {
    return place.lat != null && place.lng != null
      ? `https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w`
      : `https://maps.apple.com/?daddr=${encodeURIComponent(query)}&dirflg=w`;
  }
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${encodeURIComponent(query)}`;
}
