import { API_BASE } from "./config";

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
  const res = await fetch(`${API_BASE}/ivf/stations`);
  if (!res.ok) throw new Error("Kunne ikke hente værstasjoner");
  return res.json();
}

export async function fetchIvfData(stationId: string): Promise<IvfResponse> {
  const res = await fetch(`${API_BASE}/ivf/ivf/${stationId}`);
  if (!res.ok) throw new Error((await res.text()) || "Kunne ikke hente IVF-data");
  return res.json();
}
