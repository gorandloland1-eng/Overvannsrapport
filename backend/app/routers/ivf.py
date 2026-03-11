from fastapi import APIRouter, HTTPException
import requests
import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID  = os.getenv("FROST_CLIENT_ID")
FROST_BASE = "https://frost.met.no"
IDF_STATION = "https://frost-rc.met.no/api/v1/rainfall/idf/station"
IDF_GRID    = "https://frost-rc.met.no/api/v1/rainfall/idf/grid"
AUTH        = (CLIENT_ID, "")

router = APIRouter()

SESSION = requests.Session()
SESSION.auth = AUTH
SESSION.headers.update({"Accept": "application/json", "User-Agent": "Mozilla/5.0"})

RETURN_PERIODS = [2, 5, 10, 20, 25, 50, 100, 200]


def mm_to_lsha(mm: float, dur_min: int) -> float:
    return round(mm / (dur_min * 0.006), 1)

# --- All weather stations --- #
@router.get("/stations")
def get_stations():
    results: dict[str, dict] = {}
    for element in ["sum(precipitation_amount PT1M)", "sum(precipitation_amount PT10M)"]:
        r = SESSION.get(
            f"{FROST_BASE}/sources/v0.jsonld",
            params={"country": "NO", "elements": element,
                    "fields": "id,name,municipality,county,geometry"},
            timeout=30,
        )
        if r.status_code == 200:
            for s in r.json().get("data", []):
                sid = s["id"]
                if sid not in results:
                    geom   = s.get("geometry", {})
                    coords = geom.get("coordinates", [None, None]) if geom else [None, None]
                    results[sid] = {
                        "id":           sid,
                        "name":         s.get("name", sid),
                        "municipality": s.get("municipality"),
                        "county":       s.get("county"),
                        "lon":          coords[0],
                        "lat":          coords[1],
                    }
    print(f"Stations: {len(results)} totalt")
    return list(results.values())




# --- Weather station info fields for table --- #
@router.get("/ivf/{station_id}")
def get_ivf(station_id: str):
    # 1. Hent stasjonsnavn fra Frost
    sr = SESSION.get(
        f"{FROST_BASE}/sources/v0.jsonld",
        params={"ids": station_id, "fields": "id,name,geometry"},
        timeout=15,
    )
    if sr.status_code != 200 or not sr.json().get("data"):
        raise HTTPException(status_code=404, detail=f"Fant ikke stasjon {station_id}")

    src          = sr.json()["data"][0]
    station_name = src.get("name", station_id)
    geom         = src.get("geometry", {})
    coords       = geom.get("coordinates", []) if geom else []
    lon = coords[0] if len(coords) >= 2 else None
    lat = coords[1] if len(coords) >= 2 else None

    # 2. Hent per-station IDF — fjern "SN"-prefix for frost-rc
    numeric_id = station_id.upper().replace("SN", "")

    r_mm = requests.get(
        IDF_STATION,
        params={"stationids": numeric_id, "unit": "mm"},
        auth=AUTH, timeout=30,
    )

    # Fallback til grid hvis stasjonen ikke finnes i per-station API
    use_grid = r_mm.status_code != 200
    if r_mm.status_code == 200:
        sources = r_mm.json().get("stations", [])  # prøv begge nøkler
        if not sources:
            sources = r_mm.json().get("sources", [])
        if not sources:
            use_grid = True

    if use_grid:
        if lon is None:
            raise HTTPException(status_code=404, detail="Ingen IVF-data og ingen koordinater for stasjon")
        print(f"  {station_id}: fallback til grid ({lon}, {lat})")
        r_g = requests.get(IDF_GRID, params={"location": f"POINT({lon} {lat})", "unit": "mm"}, auth=AUTH, timeout=30)
        if r_g.status_code != 200:
            raise HTTPException(status_code=502, detail="Ingen IVF-data tilgjengelig for denne stasjonen")
        grid_vals = r_g.json().get("values", [])
        meta = r_g.json()
        mm_vals = grid_vals
        first_year = meta.get("firstYearOfPeriod")
        last_year  = meta.get("lastYearOfPeriod")
        n_seasons  = (last_year or 0) - (first_year or 0)
        source_type = "grid"
    else:
        station_data = sources[0]
        mm_vals    = station_data.get("values", [])
        first_year = None
        to_time    = station_data.get("toTime", "")
        from_time  = station_data.get("fromTime", "")
        last_year  = int(to_time[:4]) if to_time else None
        first_year = int(from_time[:4]) if from_time else None
        n_seasons  = station_data.get("numberOfSeasons", 0)
        source_type = "station"
        print(f"  {station_id}: {n_seasons} sesonger, {len(mm_vals)} verdier")

    # 3. Bygg tabeller — konverter mm til lsha
    ls_ha: dict[str, dict[str, float]] = {}
    mm_out: dict[str, dict[str, float]] = {}

    for v in mm_vals:
        dur = str(v["duration"])
        T   = str(v["frequency"])
        mm_val = v["intensity"]
        mm_out.setdefault(dur, {})[T] = round(mm_val, 1)
        ls_ha.setdefault(dur, {})[T]  = mm_to_lsha(mm_val, int(dur))

    if not ls_ha:
        raise HTTPException(status_code=404, detail="Ingen IVF-data for denne stasjonen")

    durations = sorted([int(d) for d in ls_ha.keys()])

    return {
        "station_id":     station_id,
        "station_name":   station_name,
        "lon":            lon,
        "lat":            lat,
        "n_years":        n_seasons,
        "first_year":     first_year,
        "last_year":      last_year,
        "source_type":    source_type,
        "durations":      durations,
        "return_periods": RETURN_PERIODS,
        "ls_ha":          ls_ha,
        "mm":             mm_out,
    }