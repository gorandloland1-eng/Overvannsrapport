import { API_BASE } from "./config";

export type TerrainResponse = {
  lengde_m: number;
  hoydeforskjell_m: number;
  konsentrasjonstid_min: number;
  konsentrasjonstid_ivf_min: number;
  elev1: number;
  elev2: number;
};

export async function fetchTerrain(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<TerrainResponse> {
  const res = await fetch(`${API_BASE}/calculate-terrain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat1, lng1, lat2, lng2 }),
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}
