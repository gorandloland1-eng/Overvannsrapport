import math
import os
import xml.etree.ElementTree as ET
from typing import Any

import requests
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1/eiendom", tags=["eiendom"])

TIMEOUT = float(os.getenv("GEONORGE_TIMEOUT_SECONDS", "10"))

GEONORGE_WFS_URL = "https://wfs.geonorge.no/skwms1/wfs.matrikkelen-eiendomskart-teig"
GEONORGE_ADRESSE_URL = "https://ws.geonorge.no/adresser/v1/sok"
GEONORGE_ADRESSE_PUNKT_URL = "https://ws.geonorge.no/adresser/v1/punkt"

APP_NS = "http://skjema.geonorge.no/SOSI/produktspesifikasjon/Matrikkelen-Eiendomskart-Teig/20211101"
GML_NS = "http://www.opengis.net/gml/3.2"


# ---------------------------------------------------------------------------
# MODELS
# ---------------------------------------------------------------------------

class EiendomOppslagRequest(BaseModel):
    kommunenummer: str = Field(min_length=4, max_length=4)
    gardsnummer: int
    bruksnummer: int
    festenummer: int | None = None
    seksjonsnummer: int | None = None

class LatLng(BaseModel):
    lat: float
    lng: float

class Bounds(BaseModel):
    south: float
    north: float
    west: float
    east: float

class EiendomOppslagResponse(BaseModel):
    eiendom_id: str
    kommunenummer: str
    gardsnummer: int
    bruksnummer: int
    adresse: str | None = None
    centroid: LatLng | None = None
    bounds: Bounds | None = None
    polygon: dict | None = None
    warnings: list[str] = Field(default_factory=list)

class EiendomMatrikkelDto(BaseModel):
    gnr: int
    bnr: int
    kommunenummer: str = ""

class EiendomPunktResponse(BaseModel):
    adresse: str | None = None
    matrikkel: EiendomMatrikkelDto | None = None
    grense: dict[str, Any] | None = None
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# UTM33 -> LAT/LNG
# ---------------------------------------------------------------------------

def _utm33_to_latlng(easting: float, northing: float) -> tuple[float, float]:
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    lon0 = math.radians(15)

    x = easting - 500000
    y = northing

    m = y / k0
    mu = m / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256))

    phi1 = mu
    phi1 += (3*e1/2 - 27*e1**3/32) * math.sin(2*mu)
    phi1 += (21*e1**2/16 - 55*e1**4/32) * math.sin(4*mu)
    phi1 += (151*e1**3/96) * math.sin(6*mu)
    phi1 += (1097*e1**4/512) * math.sin(8*mu)

    n1 = a / math.sqrt(1 - e2 * math.sin(phi1)**2)
    t1 = math.tan(phi1)**2
    c1 = ep2 * math.cos(phi1)**2
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1)**2)**1.5
    d = x / (n1 * k0)

    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d**2/2
        - (5 + 3*t1 + 10*c1 - 4*c1**2 - 9*ep2) * d**4/24
        + (61 + 90*t1 + 298*c1 + 45*t1**2 - 252*ep2 - 3*c1**2) * d**6/720
    )
    lon = lon0 + (
        d
        - (1 + 2*t1 + c1) * d**3/6
        + (5 - 2*c1 + 28*t1 - 3*c1**2 + 8*ep2 + 24*t1**2) * d**5/120
    ) / math.cos(phi1)

    return math.degrees(lat), math.degrees(lon)


# ---------------------------------------------------------------------------
# GEOMETRY UTILS
# ---------------------------------------------------------------------------

def _flatten_coords(coords: list) -> list:
    if not coords:
        return []
    if isinstance(coords[0][0][0], list):
        flat = []
        for polygon in coords:
            for ring in polygon:
                flat.extend(ring)
        return flat
    else:
        return coords[0]

def _calculate_centroid(coords: list) -> dict:
    points = _flatten_coords(coords)
    lng = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return {"lat": lat, "lng": lng}

def _calculate_bounds(coords: list) -> dict:
    points = _flatten_coords(coords)
    lngs = [p[0] for p in points]
    lats = [p[1] for p in points]
    return {
        "south": min(lats),
        "north": max(lats),
        "west": min(lngs),
        "east": max(lngs),
    }


# ---------------------------------------------------------------------------
# HTTP HELPER
# ---------------------------------------------------------------------------

def _safe_get_json(url: str, params: dict[str, Any]) -> dict | None:
    try:
        res = requests.get(url, params=params, timeout=TIMEOUT)
        print(f"[HTTP] {res.url} -> {res.status_code}")
        if res.status_code >= 400:
            print(f"[HTTP] error: {res.text[:300]}")
            return None
        return res.json()
    except Exception as e:
        print(f"[HTTP ERROR] {e}")
        return None

def _to_int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# WFS: parse GML rings (UTM33 -> WGS84)
# ---------------------------------------------------------------------------

def _parse_gml_rings(response_content: bytes) -> list:
    root = ET.fromstring(response_content)
    rings = []
    for pos_list in root.iter(f"{{{GML_NS}}}posList"):
        text = pos_list.text.strip()
        nums = list(map(float, text.split()))
        ring = []
        for i in range(0, len(nums) - 1, 2):
            easting, northing = nums[i], nums[i + 1]
            lat, lng = _utm33_to_latlng(easting, northing)
            ring.append([lng, lat])  # GeoJSON: [lng, lat]
        if ring:
            rings.append(ring)
    return rings


# ---------------------------------------------------------------------------
# WFS: hent polygon via BBOX (brukes av begge endepunkter)
# ---------------------------------------------------------------------------

def _hent_grense_fra_bbox(lat: float, lng: float) -> dict[str, Any] | None:
    delta_lat = 0.003
    delta_lng = 0.005

    try:
        response = requests.get(
            GEONORGE_WFS_URL,
            params={
                "SERVICE": "WFS",
                "REQUEST": "GetFeature",
                "VERSION": "2.0.0",
                "TYPENAMES": "app:Teig",
                "NAMESPACES": f"xmlns(app,{APP_NS})",
                "SRSNAME": "urn:ogc:def:crs:EPSG::25833",
                "COUNT": 1,
                "BBOX": f"{lng - delta_lng},{lat - delta_lat},{lng + delta_lng},{lat + delta_lat},EPSG:4326",
            },
            timeout=TIMEOUT,
        )
        print(f"[WFS BBOX] status={response.status_code}")
    except requests.RequestException as e:
        print(f"[WFS BBOX] failed: {e}")
        return None

    if response.status_code >= 400:
        return None

    try:
        rings = _parse_gml_rings(response.content)
        print(f"[WFS BBOX] parsed {len(rings)} rings")
        if not rings:
            return None

        geometry = (
            {"type": "Polygon", "coordinates": rings}
            if len(rings) == 1
            else {"type": "MultiPolygon", "coordinates": [[ring] for ring in rings]}
        )
        return {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "geometry": geometry, "properties": {}}]
        }
    except ET.ParseError as e:
        print(f"[WFS BBOX] parse error: {e}")
        return None


# ---------------------------------------------------------------------------
# ADRESSE: hent koordinat og adressetekst
# ---------------------------------------------------------------------------

def _hent_adresse_med_koordinat(knr: str, gnr: int, bnr: int) -> tuple[str | None, float | None, float | None]:
    """Returnerer (adresse, lat, lng) eller (None, None, None)"""
    data = _safe_get_json(
        GEONORGE_ADRESSE_URL,
        params={
            "kommunenummer": knr,
            "gardsnummer": gnr,
            "bruksnummer": bnr,
            "treffPerSide": 1,
            "utkoordsys": 4326,
        },
    )
    if not data:
        return None, None, None
    adresser = data.get("adresser", [])
    if not adresser or not isinstance(adresser[0], dict):
        return None, None, None

    first = adresser[0]
    tekst = first.get("adressetekst")
    kommune = first.get("kommunenavn")
    adresse = f"{tekst}, {kommune}" if tekst and kommune else (str(tekst) if tekst else None)

    rep = first.get("representasjonspunkt", {})
    lat = rep.get("lat")
    lng = rep.get("lon")

    return adresse, lat, lng


def _hent_adresse(knr: str, gnr: int, bnr: int) -> str | None:
    adresse, _, _ = _hent_adresse_med_koordinat(knr, gnr, bnr)
    return adresse


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------

@router.post("/oppslag", response_model=EiendomOppslagResponse)
def eiendom_oppslag(payload: EiendomOppslagRequest) -> EiendomOppslagResponse:
    print(f"\n{'='*40}")
    print(f"[oppslag] knr={payload.kommunenummer} gnr={payload.gardsnummer} bnr={payload.bruksnummer}")
    warnings: list[str] = []

    # Steg 1: hent koordinat fra adresse-API
    adresse, lat, lng = _hent_adresse_med_koordinat(
        payload.kommunenummer,
        payload.gardsnummer,
        payload.bruksnummer,
    )
    print(f"[oppslag] adresse={adresse} koordinat=lat={lat} lng={lng}")

    if not adresse:
        warnings.append("Fant ingen adresse for dette gårds- og bruksnummeret.")

    # Steg 2: hent polygon via BBOX fra koordinat
    geojson = None
    centroid = None
    bounds = None

    if lat is not None and lng is not None:
        grense = _hent_grense_fra_bbox(lat, lng)
        if grense and grense.get("features"):
            geojson = grense
            geometry = grense["features"][0]["geometry"]
            centroid_raw = _calculate_centroid(geometry["coordinates"])
            bounds_raw = _calculate_bounds(geometry["coordinates"])
            centroid = LatLng(**centroid_raw)
            bounds = Bounds(**bounds_raw)
            # Legg til matrikkelinfo i properties
            grense["features"][0]["properties"] = {
                "kommunenummer": payload.kommunenummer,
                "gaardsnummer": payload.gardsnummer,
                "bruksnummer": payload.bruksnummer,
            }
        else:
            warnings.append("Fant ingen eiendomsgrense for dette gårds- og bruksnummeret.")
    else:
        warnings.append("Fant ingen eiendomsgrense for dette gårds- og bruksnummeret.")

    print(f"[oppslag] polygon={'yes' if geojson else 'no'} centroid={centroid} bounds={bounds}")
    print(f"{'='*40}\n")

    return EiendomOppslagResponse(
        eiendom_id=f"{payload.kommunenummer}-{payload.gardsnummer}/{payload.bruksnummer}",
        kommunenummer=payload.kommunenummer,
        gardsnummer=payload.gardsnummer,
        bruksnummer=payload.bruksnummer,
        adresse=adresse,
        centroid=centroid,
        bounds=bounds,
        polygon=geojson,
        warnings=warnings,
    )


@router.get("/punkt", response_model=EiendomPunktResponse)
def eiendom_for_punkt(lat: float, lng: float, radius: int = 50) -> EiendomPunktResponse:
    print(f"\n{'='*40}")
    print(f"[punkt] lat={lat} lng={lng}")
    warnings: list[str] = []

    adresse_data = _safe_get_json(
        GEONORGE_ADRESSE_PUNKT_URL,
        params={
            "nord": lat,
            "ost": lng,
            "koordsys": 4326,
            "radius": radius,
            "utkoordsys": 4326,
        },
    )

    adresse: str | None = None
    matrikkel: EiendomMatrikkelDto | None = None

    if adresse_data:
        adresser = adresse_data.get("adresser", [])
        if adresser and isinstance(adresser[0], dict):
            first = adresser[0]
            tekst = first.get("adressetekst")
            kommune = first.get("kommunenavn")
            if tekst and kommune:
                adresse = f"{tekst}, {kommune}"
            elif tekst:
                adresse = str(tekst)

            gnr = _to_int_or_none(first.get("gardsnummer"))
            bnr = _to_int_or_none(first.get("bruksnummer"))
            if gnr is not None and bnr is not None:
                matrikkel = EiendomMatrikkelDto(
                    gnr=gnr,
                    bnr=bnr,
                    kommunenummer=str(first.get("kommunenummer") or ""),
                )

    grense = _hent_grense_fra_bbox(lat, lng)

    if not adresse and not matrikkel:
        warnings.append("Fant ingen adresse for denne plasseringen.")
    if not grense:
        warnings.append("Fant ingen eiendomsgrense for denne plasseringen.")

    print(f"[punkt] adresse={adresse} grense={'yes' if grense else 'no'}")
    print(f"{'='*40}\n")

    return EiendomPunktResponse(
        adresse=adresse,
        matrikkel=matrikkel,
        grense=grense,
        warnings=warnings,
    )
