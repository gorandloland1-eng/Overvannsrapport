import { API_BASE, apiFetch } from "./config";

export type WeatherStation = {
  id: string;
  name: string;
  municipality?: string;
  county?: string;
  lat?: number | null;
  lon?: number | null;
};

export type IvfResponse = {
  station_id: string;
  station_name: string;
  durations: number[];
  return_periods: number[];
  ls_ha: Record<string, Record<string, number>>;
  mm: Record<string, Record<string, number>>;
  first_year?: number | null;
  last_year?: number | null;
  source_type?: string;
};

export async function fetchWeatherStations(): Promise<WeatherStation[]> {
  const res = await apiFetch(`${API_BASE}/ivf/stations`);
  if (!res.ok) throw new Error("Kunne ikke hente værstasjoner");
  return res.json();
}

async function getSafeApiError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = await res.json();
    if (typeof payload?.detail === "string") {
      return payload.detail;
    }
  } catch {
    // Ignore non-JSON error bodies.
  }

  if (res.status === 504) {
    return "Værdatatjenesten brukte for lang tid. Prøv igjen.";
  }

  return fallback;
}

export async function fetchIvfData(
  stationId: string,
  signal?: AbortSignal
): Promise<IvfResponse> {
  const res = await apiFetch(`${API_BASE}/ivf/${stationId}`, { signal });
  if (!res.ok) {
    throw new Error(await getSafeApiError(res, "Kunne ikke hente IVF-data"));
  }
  return res.json();
}
