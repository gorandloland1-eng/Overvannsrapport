const BASE = "http://localhost:8000";

export type PdfPayload = {
  project_name: string;
  height: number;
  length: number;
  time_of_concentration: number;
  areal: number;
  returperiode: number;
  klimafaktor: number;
  maks_paslipp: number;
  infiltrasjonskapasitet: number;
  eiendom_adresse: string | null;
  eiendom_gnr: number | null;
  eiendom_bnr: number | null;
  phi: number;
  selected_weather_station: string;
  selected_weather_station_name: string;
};

export type PdfResponse = {
  filepath: string;
  filename: string;
  firebase_url: string;
  calc_firebase_url: string;
};

export async function generatePdf(payload: PdfPayload): Promise<PdfResponse> {
  const res = await fetch(`${BASE}/pdf/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.text()) || "Kunne ikke generere PDF");
  return res.json();
}
