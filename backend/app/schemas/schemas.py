from pydantic import BaseModel

class AronKiblerRequest(BaseModel):
    areal_ha: float
    phi: float
    konsentrasjonstid_min: float
    returperiode_ar: int
    klimafaktor: float
    maks_paslipp_l_s: float
    infiltrasjonskapasitet_l_s: float

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