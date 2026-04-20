const BASE = "http://localhost:8000";

export type PropertyPointResponse = {
  adresse: string | null;
  matrikkel: { gnr: number; bnr: number; kommunenummer: string } | null;
  grense: object | null;
  warnings: string[];
};

export type PropertyLookupResponse = {
  eiendoms_id: string;
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  festenummer: number | null;
  seksjonsnummer: number | null;
  adresse: string | null;
  grense: object | null;
  warnings: string[];
};

export async function fetchPropertyByPoint(
  lat: number,
  lng: number,
  radius = 50
): Promise<PropertyPointResponse> {
  const res = await fetch(
    `${BASE}/v1/eiendom/punkt?lat=${lat}&lng=${lng}&radius=${radius}`
  );
  if (!res.ok) throw new Error((await res.text()) || "Could not fetch property data");
  return res.json();
}

export async function fetchPropertyByMatrikkel(
  municipalityNumber: string,
  cadastralUnitNumber: number,
  propertyUnitNumber: number,
  leaseNumber?: number,
  sectionNumber?: number
): Promise<PropertyLookupResponse> {
  const res = await fetch(`${BASE}/v1/eiendom/oppslag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kommunenummer: municipalityNumber,
      gardsnummer: cadastralUnitNumber,
      bruksnummer: propertyUnitNumber,
      festenummer: leaseNumber ?? null,
      seksjonsnummer: sectionNumber ?? null,
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Could not look up property");
  return res.json();
}