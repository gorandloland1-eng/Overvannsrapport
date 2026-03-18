from pydantic import BaseModel, model_validator
from typing import Optional

class AronKiblerRequest(BaseModel):
    areal_ha: float
    phi: float
    konsentrasjonstid_min: float
    returperiode_ar: int
    klimafaktor: float
    maks_paslipp_l_s: float
    infiltrasjonskapasitet_l_s: float = 0.0    # Alt B – direkte Q_inf
    jordtype: Optional[str] = None              # Alt A
    areal_bunnflate_m2: Optional[float] = None  # Alt A
    areal_sideflater_m2: Optional[float] = None # Alt A

    @model_validator(mode="after")
    def validate_infiltrasjon(self) -> "AronKiblerRequest":
        alt_a = [self.jordtype, self.areal_bunnflate_m2, self.areal_sideflater_m2]
        if any(f is not None for f in alt_a) and not all(f is not None for f in alt_a):
            raise ValueError(
                "Alt A krever jordtype, areal_bunnflate_m2 og areal_sideflater_m2 – alle tre må oppgis."
            )
        return self

# --- Table row --- #
class DimensjonerendeRad(BaseModel):
    varighet_min: float
    intensitet_l_s_ha: float
    Q_inn_l_s: float
    V_inn_m3: float
    V_ut_m3: float
    utjevningsvolum_m3: float

class AronKiblerResponse(BaseModel):
    dim_varighet_min: float
    dim_intensitet_l_s_ha: float
    dim_Q_inn_l_s: float
    dim_utjevningsvolum_m3: float
    tabell: list[DimensjonerendeRad]


# --- Look up --- #
class PropertyLookupRequest(BaseModel):
    eiendoms_id: str | None
    gardsnummer: str | None
    postnummer: str | None

# --- Cordinates --- #
class PropertyLookupResponse(BaseModel):
    lat: float
    lng: float

# --- Weather station look up --- #
class WeatherStation(BaseModel):
    id: str
    name: str
    lat: float
    lng: float

class TwoPointRequest(BaseModel):
    lat1: float
    lng1: float
    lat2: float
    lng2: float

class PDFRequest(BaseModel):
    project_name: str
    elev1: Optional[float] = None
    elev2: Optional[float] = None
    height: float
    length: float
    time_of_concentration: float
    areal: float
    returperiode: int
    klimafaktor: float
    maks_paslipp: float
    infiltrasjonskapasitet: float = 0.0
    # Eiendom
    eiendom_adresse: Optional[str] = None
    eiendom_gnr: Optional[int] = None
    eiendom_bnr: Optional[int] = None
    phi: float = 0.9 
    selected_weather_station: str = ""
    selected_weather_station_name: str = ""