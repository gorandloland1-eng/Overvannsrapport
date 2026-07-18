from fastapi import APIRouter, HTTPException, Query
import requests
import os
import time
import json
import threading
import math
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("FROST_CLIENT_ID")
FROST_BASE = "https://frost.met.no"
IDF_STATION = "https://frost-rc.met.no/api/v1/rainfall/idf/station"
IDF_GRID = "https://frost-rc.met.no/api/v1/rainfall/idf/grid"
AUTH = (CLIENT_ID, "")
FROST_CONNECT_TIMEOUT_SECONDS = 5
FROST_READ_TIMEOUT_SECONDS = 20
FROST_TIMEOUT = (FROST_CONNECT_TIMEOUT_SECONDS, FROST_READ_TIMEOUT_SECONDS)

router = APIRouter()

SESSION = requests.Session()
SESSION.auth = AUTH
SESSION.headers.update({
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
})

RETURN_PERIODS = [2, 5, 10, 20, 25, 50, 100, 200]
REQUIRED_SHORT_DURATIONS = {1, 2, 3, 5}

CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)
STATIONS_CACHE_FILE = CACHE_DIR / "filtered_weather_stations.json"
CACHE_MAX_AGE_SECONDS = 60 * 60 * 24

_cache_lock = threading.Lock()
_cache_building = False
_source_metadata_cache: dict[str, dict] = {}
_source_metadata_lock = threading.Lock()


def _log_frost_failure(
    station_id: str,
    endpoint: str,
    failure_type: str,
    *,
    status_code: int | None = None,
    timeout: tuple[int, int] | None = None,
    exc: BaseException | None = None,
) -> None:
    parts = [
        f"[Frost] station={station_id}",
        f"endpoint={endpoint}",
        f"type={failure_type}",
    ]
    if status_code is not None:
        parts.append(f"status={status_code}")
    if timeout is not None:
        parts.append(f"connect_timeout={timeout[0]}s")
        parts.append(f"read_timeout={timeout[1]}s")
    if exc is not None:
        parts.append(f"exception={type(exc).__name__}")

    print(" ".join(parts))


def _safe_frost_json(
    *,
    station_id: str,
    endpoint: str,
    url: str,
    params: dict,
    timeout: tuple[int, int] = FROST_TIMEOUT,
) -> tuple[int, dict | None]:
    try:
        response = SESSION.get(url, params=params, timeout=timeout)
    except requests.exceptions.ConnectTimeout as exc:
        _log_frost_failure(
            station_id,
            endpoint,
            "connect_timeout",
            timeout=timeout,
            exc=exc,
        )
        raise HTTPException(
            status_code=504,
            detail="Værdatatjenesten brukte for lang tid på å koble til. Prøv igjen.",
        )
    except requests.exceptions.ReadTimeout as exc:
        _log_frost_failure(
            station_id,
            endpoint,
            "read_timeout",
            timeout=timeout,
            exc=exc,
        )
        raise HTTPException(
            status_code=504,
            detail="Værdatatjenesten brukte for lang tid på å svare. Prøv igjen.",
        )
    except requests.exceptions.ConnectionError as exc:
        _log_frost_failure(station_id, endpoint, "connection_error", exc=exc)
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten kunne ikke nås. Prøv igjen senere.",
        )
    except requests.exceptions.RequestException as exc:
        _log_frost_failure(station_id, endpoint, "request_error", exc=exc)
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten feilet. Prøv igjen senere.",
        )

    if response.status_code == 404:
        _log_frost_failure(station_id, endpoint, "not_found", status_code=response.status_code)
        return response.status_code, None

    if response.status_code >= 400:
        _log_frost_failure(
            station_id,
            endpoint,
            "http_error",
            status_code=response.status_code,
        )
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten returnerte en feil. Prøv igjen senere.",
        )

    content_type = response.headers.get("Content-Type", "")
    if "json" not in content_type.lower():
        _log_frost_failure(station_id, endpoint, "invalid_content_type")
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten returnerte ugyldig data.",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        _log_frost_failure(station_id, endpoint, "invalid_json", exc=exc)
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten returnerte ugyldig JSON.",
        )

    if not isinstance(payload, dict):
        _log_frost_failure(station_id, endpoint, "invalid_json_shape")
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten returnerte uventet dataformat.",
        )

    return response.status_code, payload


def _parse_ivf_value(row: dict) -> tuple[int, int, float] | None:
    if not isinstance(row, dict):
        return None

    try:
        duration = int(row.get("duration"))
        frequency = int(row.get("frequency"))
        intensity = float(row.get("intensity"))
    except (TypeError, ValueError):
        return None

    if duration <= 0 or frequency <= 0 or intensity < 0:
        return None

    return duration, frequency, intensity


def get_station_source_metadata(station_id: str) -> dict:
    with _source_metadata_lock:
        cached = _source_metadata_cache.get(station_id)
    if cached is not None:
        return cached

    _, payload = _safe_frost_json(
        station_id=station_id,
        endpoint="sources",
        url=f"{FROST_BASE}/sources/v0.jsonld",
        params={"ids": station_id, "fields": "id,name,geometry"},
    )

    sources = payload.get("data", []) if payload else []
    if not isinstance(sources, list) or not sources:
        raise HTTPException(status_code=404, detail=f"Fant ikke stasjon {station_id}")

    source = sources[0]
    if not isinstance(source, dict):
        _log_frost_failure(station_id, "sources", "invalid_station_shape")
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten returnerte uventet stasjonsformat.",
        )

    with _source_metadata_lock:
        _source_metadata_cache[station_id] = source

    return source


def mm_to_lsha(mm: float, dur_min: int) -> float:
    return round(mm / (dur_min * 0.006), 1)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def extract_station_sources(payload: dict):
    sources = payload.get("stations", [])
    if not sources:
        sources = payload.get("sources", [])
    return sources


def parse_duration_set(values: list) -> set[int]:
    durations = set()

    for v in values:
        dur = v.get("duration")
        try:
            durations.add(int(dur))
        except (TypeError, ValueError):
            continue

    return durations


def fetch_all_raw_stations() -> list[dict]:
    results: dict[str, dict] = {}

    for element in [
        "sum(precipitation_amount PT1M)",
        "sum(precipitation_amount PT10M)",
    ]:
        r = SESSION.get(
            f"{FROST_BASE}/sources/v0.jsonld",
            params={
                "country": "NO",
                "elements": element,
                "fields": "id,name,municipality,county,geometry",
            },
            timeout=30,
        )

        if r.status_code == 200:
            for s in r.json().get("data", []):
                sid = s["id"]

                if sid not in results:
                    geom = s.get("geometry", {})
                    coords = geom.get("coordinates", [None, None]) if geom else [None, None]

                    results[sid] = {
                        "id": sid,
                        "name": s.get("name", sid),
                        "municipality": s.get("municipality"),
                        "county": s.get("county"),
                        "lon": coords[0],
                        "lat": coords[1],
                    }

    stations = list(results.values())
    stations.sort(key=lambda s: (s.get("name") or "").lower())
    return stations


def get_station_idf_data(station_id: str):
    numeric_id = station_id.upper().replace("SN", "")

    r = SESSION.get(
        IDF_STATION,
        params={"stationids": numeric_id, "unit": "mm"},
        timeout=20,
    )

    if r.status_code != 200:
        return None

    sources = extract_station_sources(r.json())
    if not sources:
        return None

    return sources[0]


def is_stable_station(station_id: str) -> bool:
    station_data = get_station_idf_data(station_id)
    if not station_data:
        return False

    values = station_data.get("values", [])
    if not values:
        return False

    durations = parse_duration_set(values)
    if not durations:
        return False

    has_short_durations = any(d in REQUIRED_SHORT_DURATIONS for d in durations)

    if not has_short_durations:
        return False

    return True


def load_cached_filtered_stations():
    if not STATIONS_CACHE_FILE.exists():
        return None

    try:
        with open(STATIONS_CACHE_FILE, "r", encoding="utf-8") as f:
            payload = json.load(f)

        cached_at = payload.get("cached_at", 0)
        stations = payload.get("stations", [])

        if not isinstance(stations, list):
            return None

        age = time.time() - cached_at
        is_fresh = age < CACHE_MAX_AGE_SECONDS

        return {
            "stations": stations,
            "cached_at": cached_at,
            "is_fresh": is_fresh,
        }

    except Exception as e:
        print(f"Kunne ikke lese cache-fil: {e}")
        return None


def save_cached_filtered_stations(stations: list[dict]):
    payload = {
        "cached_at": time.time(),
        "stations": stations,
    }

    with open(STATIONS_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def build_filtered_stations_cache():
    global _cache_building

    with _cache_lock:
        if _cache_building:
            return
        _cache_building = True

    try:
        print("Starter bygging av filtrert værstasjon-cache ...")

        all_stations = fetch_all_raw_stations()
        filtered_stations = []

        for idx, station in enumerate(all_stations, start=1):
            sid = station["id"]

            try:
                if is_stable_station(sid):
                    filtered_stations.append(station)
            except Exception as e:
                print(f"Filtrering feilet for {sid}: {e}")

            if idx % 25 == 0:
                print(f"Filtrert {idx}/{len(all_stations)} stasjoner ...")

        filtered_stations.sort(key=lambda s: (s.get("name") or "").lower())
        save_cached_filtered_stations(filtered_stations)

        print(
            f"Ferdig med cache: {len(all_stations)} totalt, "
            f"{len(filtered_stations)} stabile stasjoner lagret"
        )

    finally:
        with _cache_lock:
            _cache_building = False


def ensure_cache_in_background():
    cached = load_cached_filtered_stations()

    if cached and cached["is_fresh"]:
        return

    global _cache_building
    with _cache_lock:
        if _cache_building:
            return

    threading.Thread(target=build_filtered_stations_cache, daemon=True).start()


@router.get("/stations")
def get_stations():
    cached = load_cached_filtered_stations()

    if cached and cached["stations"]:
        if not cached["is_fresh"]:
            ensure_cache_in_background()

        print(f"Stations: returnerer cache ({len(cached['stations'])} stasjoner)")
        return cached["stations"]

    print("Ingen cache funnet. Bygger filtrert stasjonsliste nå ...")
    build_filtered_stations_cache()

    cached = load_cached_filtered_stations()
    if cached and cached["stations"]:
        print(f"Stations: returnerer nybygd cache ({len(cached['stations'])} stasjoner)")
        return cached["stations"]

    print("Fant ingen filtrerte stasjoner")
    return []


@router.get("/stations/nearest")
def get_nearest_station(
    lat: float = Query(...),
    lon: float = Query(...),
):
    cached = load_cached_filtered_stations()

    if not cached or not cached["stations"]:
        print("Ingen cache funnet ved nearest. Bygger cache ...")
        build_filtered_stations_cache()
        cached = load_cached_filtered_stations()

    if not cached or not cached["stations"]:
        raise HTTPException(status_code=404, detail="Fant ingen værstasjoner")

    valid_stations = [
        station for station in cached["stations"]
        if station.get("lat") is not None and station.get("lon") is not None
    ]

    if not valid_stations:
        raise HTTPException(status_code=404, detail="Ingen værstasjoner har koordinater")

    nearest = min(
        valid_stations,
        key=lambda station: haversine_distance_km(
            lat,
            lon,
            float(station["lat"]),
            float(station["lon"]),
        ),
    )

    distance_km = haversine_distance_km(
        lat,
        lon,
        float(nearest["lat"]),
        float(nearest["lon"]),
    )

    return {
        **nearest,
        "distance_km": round(distance_km, 2),
    }


@router.get("/{station_id}")
def get_ivf(station_id: str):
    src = get_station_source_metadata(station_id)
    station_name = src.get("name", station_id)
    geom = src.get("geometry", {})
    coords = geom.get("coordinates", []) if geom else []

    lon = coords[0] if len(coords) >= 2 else None
    lat = coords[1] if len(coords) >= 2 else None

    numeric_id = station_id.upper().replace("SN", "")

    status_mm, station_payload = _safe_frost_json(
        station_id=station_id,
        endpoint="idf_station",
        url=IDF_STATION,
        params={"stationids": numeric_id, "unit": "mm"},
    )

    use_grid = status_mm != 200
    sources = []

    if status_mm == 200 and station_payload:
        sources = extract_station_sources(station_payload)
        if not sources:
            use_grid = True

    if use_grid:
        if lon is None or lat is None:
            raise HTTPException(
                status_code=404,
                detail="Ingen IVF-data og ingen koordinater for stasjon",
            )

        print(f"  {station_id}: fallback til grid ({lon}, {lat})")

        status_grid, grid_json = _safe_frost_json(
            station_id=station_id,
            endpoint="idf_grid",
            url=IDF_GRID,
            params={"location": f"POINT({lon} {lat})", "unit": "mm"},
        )

        if status_grid != 200 or not grid_json:
            raise HTTPException(
                status_code=502,
                detail="Ingen IVF-data tilgjengelig for denne stasjonen",
            )

        mm_vals = grid_json.get("values", [])
        first_year = grid_json.get("firstYearOfPeriod")
        last_year = grid_json.get("lastYearOfPeriod")
        n_seasons = (last_year or 0) - (first_year or 0)
        source_type = "grid"

    else:
        station_data = sources[0]
        mm_vals = station_data.get("values", [])
        to_time = station_data.get("toTime", "")
        from_time = station_data.get("fromTime", "")

        last_year = int(to_time[:4]) if to_time else None
        first_year = int(from_time[:4]) if from_time else None
        n_seasons = station_data.get("numberOfSeasons", 0)
        source_type = "station"

        print(f"  {station_id}: {n_seasons} sesonger, {len(mm_vals)} verdier")

    ls_ha: dict[str, dict[str, float]] = {}
    mm_out: dict[str, dict[str, float]] = {}

    if not isinstance(mm_vals, list):
        _log_frost_failure(station_id, source_type, "invalid_values_shape")
        raise HTTPException(
            status_code=502,
            detail="Værdatatjenesten returnerte uventet IVF-format.",
        )

    skipped_values = 0
    for v in mm_vals:
        parsed = _parse_ivf_value(v)
        if parsed is None:
            skipped_values += 1
            continue

        duration, frequency, mm_val = parsed
        dur = str(duration)
        T = str(frequency)

        mm_out.setdefault(dur, {})[T] = round(mm_val, 1)
        ls_ha.setdefault(dur, {})[T] = mm_to_lsha(mm_val, duration)

    if skipped_values:
        print(f"[Frost] station={station_id} skipped_invalid_values={skipped_values}")

    if not ls_ha:
        raise HTTPException(status_code=404, detail="Ingen IVF-data for denne stasjonen")

    durations = sorted([int(d) for d in ls_ha.keys()])

    return {
        "station_id": station_id,
        "station_name": station_name,
        "lon": lon,
        "lat": lat,
        "n_years": n_seasons,
        "first_year": first_year,
        "last_year": last_year,
        "source_type": source_type,
        "durations": durations,
        "return_periods": RETURN_PERIODS,
        "ls_ha": ls_ha,
        "mm": mm_out,
    }
