import os
from typing import Any

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

# VI TRENGER API NØKKEL!!!!!! GEONORGE ELLER KARTVERKET ELLER BEGGE!!
router = APIRouter(prefix="/v1/eiendom", tags=["eiendom"])

KARTVERKET_BASE_URL = os.getenv("KARTVERKET_BASE_URL", "").rstrip("/")
KARTVERKET_API_KEY = os.getenv("KARTVERKET_API_KEY", "")
KARTVERKET_TIMEOUT_SECONDS = float(os.getenv("KARTVERKET_TIMEOUT_SECONDS", "15"))
GEONORGE_TIMEOUT_SECONDS = float(os.getenv("GEONORGE_TIMEOUT_SECONDS", "10"))
GEONORGE_ADRESSE_URL = "https://ws.geonorge.no/adresser/v1/punkt"
GEONORGE_WFS_URL = "https://wfs.geonorge.no/skwms1/wfs.matrikkelenhet2"
        

class EiendomOppslagRequest(BaseModel):
    eiendoms_id: str | None = None
    kommunenummer: str | None = Field(default=None, min_length=4, max_length=4)
    gardsnummer: int | None = None
    bruksnummer: int | None = None
    festenummer: int | None = None
    seksjonsnummer: int | None = None

    @model_validator(mode="after")
    def validate_identifier(self) -> "EiendomOppslagRequest":
        has_eiendoms_id = bool(self.eiendoms_id and self.eiendoms_id.strip())
        has_gnr_bnr = (
            bool(self.kommunenummer)
            and self.gardsnummer is not None
            and self.bruksnummer is not None
        )

        if has_eiendoms_id == has_gnr_bnr:
            raise ValueError(
                "Oppgi enten eiendoms_id eller kommunenummer+gardsnummer+bruksnummer."
            )
        return self


class EiendomOppslagResponse(BaseModel):
    eiendoms_id: str
    kommunenummer: str
    gardsnummer: int
    bruksnummer: int
    festenummer: int | None = None
    seksjonsnummer: int | None = None
    geometry: dict[str, Any] | None = None
    source: str = "kartverket"


class EiendomMatrikkelDto(BaseModel):
    gnr: int
    bnr: int
    kommunenummer: str = ""


class EiendomPunktResponse(BaseModel):
    adresse: str | None = None
    matrikkel: EiendomMatrikkelDto | None = None
    grense: dict[str, Any] | None = None
    warnings: list[str] = Field(default_factory=list)


def _require_config() -> None:
    if not KARTVERKET_BASE_URL:
        raise HTTPException(status_code=500, detail="Mangler KARTVERKET_BASE_URL")
    if not KARTVERKET_API_KEY:
        raise HTTPException(status_code=500, detail="Mangler KARTVERKET_API_KEY")


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {KARTVERKET_API_KEY}",
        "Accept": "application/json",
    }


def _kartverket_get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    _require_config()
    url = f"{KARTVERKET_BASE_URL}{path}"

    try:
        response = requests.get(
            url,
            headers=_auth_headers(),
            params=params,
            timeout=KARTVERKET_TIMEOUT_SECONDS,
        )
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="Timeout mot Kartverket")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Nettverksfeil mot Kartverket")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Eiendom ikke funnet")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Kartverket-feil ({response.status_code})",
        )

    return response.json()


def _normalize_eiendom(data: dict[str, Any]) -> EiendomOppslagResponse:
    kommunenummer = str(data.get("kommunenummer") or data.get("kommune") or "")
    gardsnummer = int(data.get("gardsnummer") or data.get("gnr") or 0)
    bruksnummer = int(data.get("bruksnummer") or data.get("bnr") or 0)
    festenummer = data.get("festenummer") or data.get("fnr")
    seksjonsnummer = data.get("seksjonsnummer") or data.get("snr")
    eiendoms_id = str(
        data.get("eiendomsId")
        or data.get("eiendoms_id")
        or f"{kommunenummer}-{gardsnummer}/{bruksnummer}"
    )
    geometry = data.get("geometry") or data.get("geom") or data.get("geometri")

    return EiendomOppslagResponse(
        eiendoms_id=eiendoms_id,
        kommunenummer=kommunenummer,
        gardsnummer=gardsnummer,
        bruksnummer=bruksnummer,
        festenummer=int(festenummer) if festenummer is not None else None,
        seksjonsnummer=int(seksjonsnummer) if seksjonsnummer is not None else None,
        geometry=geometry if isinstance(geometry, dict) else None,
    )


@router.post("/oppslag", response_model=EiendomOppslagResponse)
def eiendom_oppslag(payload: EiendomOppslagRequest) -> EiendomOppslagResponse:
    if payload.eiendoms_id:
        raw = _kartverket_get(f"/matrikkel/eiendom/{payload.eiendoms_id}")
        return _normalize_eiendom(raw)

    params: dict[str, Any] = {
        "kommunenummer": payload.kommunenummer,
        "gardsnummer": payload.gardsnummer,
        "bruksnummer": payload.bruksnummer,
    }
    if payload.festenummer is not None:
        params["festenummer"] = payload.festenummer
    if payload.seksjonsnummer is not None:
        params["seksjonsnummer"] = payload.seksjonsnummer

    raw = _kartverket_get("/matrikkel/eiendom", params=params)
    return _normalize_eiendom(raw)


def _safe_get_json(
    url: str, params: dict[str, Any] | None = None
) -> tuple[int | None, dict[str, Any] | None]:
    try:
        response = requests.get(url, params=params, timeout=GEONORGE_TIMEOUT_SECONDS)
    except requests.RequestException:
        return None, None

    if response.status_code >= 400:
        return response.status_code, None

    try:
        data = response.json()
    except ValueError:
        return response.status_code, None

    if isinstance(data, dict):
        return response.status_code, data
    return response.status_code, None


def _to_int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@router.get("/punkt", response_model=EiendomPunktResponse)
def eiendom_for_punkt(lat: float, lng: float, radius: int = 50) -> EiendomPunktResponse:
    delta = 0.0005
    bbox = f"{lng - delta},{lat - delta},{lng + delta},{lat + delta}"

    adresse_status, adresse_data = _safe_get_json(
        GEONORGE_ADRESSE_URL,
        params={
            "nord": lat,
            "ost": lng,
            "koordsys": 4326,
            "radius": radius,
            "utkoordsys": 4326,
        },
    )
    wfs_status, wfs_data = _safe_get_json(
        GEONORGE_WFS_URL,
        params={
            "service": "WFS",
            "request": "GetFeature",
            "version": "2.0.0",
            "typeNames": "app:MatrikkelEnhet",
            "count": 1,
            "srsName": "EPSG:4326",
            "outputFormat": "application/json",
            "BBOX": bbox,
        },
    )

    adresse: str | None = None
    matrikkel: EiendomMatrikkelDto | None = None
    grense: dict[str, Any] | None = None
    warnings: list[str] = []

    first_address = None
    if adresse_data:
        addresses = adresse_data.get("adresser")
        if isinstance(addresses, list) and len(addresses) > 0:
            candidate = addresses[0]
            if isinstance(candidate, dict):
                first_address = candidate

    if first_address:
        adressetekst = first_address.get("adressetekst")
        kommunenavn = first_address.get("kommunenavn")
        if adressetekst and kommunenavn:
            adresse = f"{adressetekst}, {kommunenavn}"
        elif adressetekst:
            adresse = str(adressetekst)

        gnr = _to_int_or_none(first_address.get("gardsnummer"))
        bnr = _to_int_or_none(first_address.get("bruksnummer"))
        if gnr is not None and bnr is not None:
            matrikkel = EiendomMatrikkelDto(
                gnr=gnr,
                bnr=bnr,
                kommunenummer=str(first_address.get("kommunenummer") or ""),
            )

    if wfs_data:
        features = wfs_data.get("features")
        if isinstance(features, list) and len(features) > 0:
            grense = wfs_data
            first_feature = features[0] if isinstance(features[0], dict) else None
            properties = (
                first_feature.get("properties")
                if first_feature and isinstance(first_feature.get("properties"), dict)
                else {}
            )
            if not matrikkel and properties:
                gnr = (
                    _to_int_or_none(properties.get("gardsnummer"))
                    or _to_int_or_none(properties.get("gårdsnummer"))
                    or _to_int_or_none(properties.get("gnr"))
                )
                bnr = (
                    _to_int_or_none(properties.get("bruksnummer"))
                    or _to_int_or_none(properties.get("bnr"))
                )
                if gnr is not None and bnr is not None:
                    matrikkel = EiendomMatrikkelDto(
                        gnr=gnr,
                        bnr=bnr,
                        kommunenummer=str(
                            properties.get("kommunenummer")
                            or properties.get("kommunenr")
                            or properties.get("knr")
                            or ""
                        ),
                    )

    adresse_failed = adresse_status is None or adresse_status >= 400
    wfs_failed = wfs_status is None or wfs_status >= 400

    if adresse_failed and wfs_failed:
        warnings.append("Kunne ikke hente eiendomsdata fra tjenestene.")
    elif adresse_failed:
        warnings.append("Fant eiendomsgrense, men fikk ikke hentet adresse.")
    elif wfs_failed:
        warnings.append("Fant adresse, men fikk ikke hentet eiendomsgrense.")

    if not adresse and not matrikkel and not grense and not warnings:
        warnings.append("Fant ingen eiendomsdata for valgt punkt.")

    return EiendomPunktResponse(
        adresse=adresse,
        matrikkel=matrikkel,
        grense=grense,
        warnings=warnings,
    )
