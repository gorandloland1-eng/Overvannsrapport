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