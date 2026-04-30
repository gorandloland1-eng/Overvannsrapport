type Position = [number, number, ...number[]];
type Ring = Position[];
type Geometry = {
  type: string;
  coordinates?: unknown;
};
type Feature = {
  type: "Feature";
  geometry?: Geometry | null;
};
type FeatureCollection = {
  type: "FeatureCollection";
  features?: Feature[];
};

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const UTM33_K0 = 0.9996;
const UTM33_LON0 = (15 * Math.PI) / 180;

function lngLatToUtm33([lng, lat]: Position) {
  const e2 = WGS84_F * (2 - WGS84_F);
  const ep2 = e2 / (1 - e2);

  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const n = WGS84_A / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const a = cosLat * (lonRad - UTM33_LON0);

  const m =
    WGS84_A *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad));

  const x =
    UTM33_K0 *
      n *
      (a +
        ((1 - t + c) * Math.pow(a, 3)) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(a, 5)) / 120) +
    500000;

  const y =
    UTM33_K0 *
    (m +
      n *
        tanLat *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * Math.pow(a, 4)) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * Math.pow(a, 6)) / 720));

  return { x, y };
}

function ringAreaM2(ring: Ring) {
  if (ring.length < 3) return 0;

  const points = ring.map(lngLatToUtm33);
  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return sum / 2;
}

function polygonAreaM2(rings: Ring[]) {
  if (!rings.length) return 0;

  const outer = Math.abs(ringAreaM2(rings[0]));
  const holes = rings.slice(1).reduce((sum, ring) => sum + Math.abs(ringAreaM2(ring)), 0);

  return Math.max(outer - holes, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGeometry(value: unknown): value is Geometry {
  return isRecord(value) && typeof value.type === "string";
}

function isFeature(value: unknown): value is Feature {
  return isRecord(value) && value.type === "Feature";
}

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return isRecord(value) && value.type === "FeatureCollection";
}

function geometryAreaM2(geometry: Geometry | null | undefined) {
  if (!geometry) return 0;

  if (geometry.type === "Polygon") {
    return polygonAreaM2((geometry.coordinates ?? []) as Ring[]);
  }

  if (geometry.type === "MultiPolygon") {
    return ((geometry.coordinates ?? []) as Ring[][]).reduce(
      (sum: number, polygon: Ring[]) => sum + polygonAreaM2(polygon),
      0
    );
  }

  return 0;
}

export function geoJsonAreaM2(geojson: unknown) {
  if (!geojson) return null;

  const area =
    isFeatureCollection(geojson)
      ? (geojson.features ?? []).reduce(
          (sum: number, feature: Feature) => sum + geometryAreaM2(feature.geometry),
          0
        )
      : isFeature(geojson)
      ? geometryAreaM2(geojson.geometry)
      : isGeometry(geojson)
      ? geometryAreaM2(geojson)
      : 0;

  return Number.isFinite(area) && area > 0 ? Math.round(area) : null;
}
