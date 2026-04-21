export function latLngToUtm33(lat: number, lng: number): { northing: number; easting: number } {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const lon0 = (15 * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const aTerm = cosLat * (lonRad - lon0);
  const m =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad));
  const easting =
    k0 * n * (aTerm +
      ((1 - t + c) * Math.pow(aTerm, 3)) / 6 +
      ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(aTerm, 5)) / 120) + 500000;
  let northing =
    k0 * (m + n * tanLat * (
      (aTerm * aTerm) / 2 +
      ((5 - t + 9 * c + 4 * c * c) * Math.pow(aTerm, 4)) / 24 +
      ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * Math.pow(aTerm, 6)) / 720));
  if (lat < 0) northing += 10000000;
  return { northing: Math.round(northing), easting: Math.round(easting - 500000) };
}