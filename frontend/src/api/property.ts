const BASE = "http://localhost:8000";

export type PropertyLookupResponse = {
  eiendom_id: string;
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  adresse: string | null;
  centroid: { lat: number; lng: number } | null;
  bounds: { south: number; north: number; west: number; east: number } | null;
  polygon: object | null;
  warnings: string[];
};

export type PropertyPointResponse = {
  adresse: string | null;
  matrikkel: { gnr: number; bnr: number; kommunenummer: string } | null;
  grense: object | null;
  warnings: string[];
};

export async function fetchPropertyByMatrikkel(
  municipalityNumber: string,
  cadastralNumber: number,
  propertyNumber: number
): Promise<PropertyLookupResponse> {
  const res = await fetch(`${BASE}/v1/eiendom/oppslag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kommunenummer: municipalityNumber,
      gardsnummer: cadastralNumber,
      bruksnummer: propertyNumber,
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Kunne ikke slå opp eiendom");
  return res.json();
}

export async function fetchPropertyByPoint(
  lat: number,
  lng: number,
  radius = 50
): Promise<PropertyPointResponse> {
  const res = await fetch(
    `${BASE}/v1/eiendom/punkt?lat=${lat}&lng=${lng}&radius=${radius}`
  );
  if (!res.ok) throw new Error((await res.text()) || "Kunne ikke hente eiendomsdata");
  return res.json();
}
