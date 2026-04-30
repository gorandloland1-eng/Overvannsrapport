import json
from typing import Iterable

import requests


KARTVERKET_ELEVATION_URL = "https://ws.geonorge.no/hoydedata/v1/punkt"
OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
REQUEST_TIMEOUT_SECONDS = 10


def _get_open_meteo_elevation(lat: float, lng: float) -> float:
    response = requests.get(
        OPEN_METEO_ELEVATION_URL,
        params={
            "latitude": lat,
            "longitude": lng
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    data = response.json()
    return float(data["elevation"][0])


def _extract_elevation(point: dict) -> float:
    elevation = point.get("z")
    if elevation is None:
        raise ValueError("Høydedata-responsen mangler z-verdi")
    return float(elevation)


def _get_kartverket_elevations(points: Iterable[tuple[float, float]]) -> list[float]:
    coordinate_pairs = [[lng, lat] for lat, lng in points]

    response = requests.get(
        KARTVERKET_ELEVATION_URL,
        params={
            "koordsys": 4258,
            "punkter": json.dumps(coordinate_pairs, separators=(",", ":")),
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    data = response.json()
    result_points = data.get("punkter") or []

    if len(result_points) != len(coordinate_pairs):
        raise ValueError("Høydedata-responsen hadde feil antall punkter")

    return [_extract_elevation(point) for point in result_points]


def get_elevations(points: Iterable[tuple[float, float]]) -> list[float]:
    point_list = list(points)
    if not point_list:
        return []

    try:
        return _get_kartverket_elevations(point_list)
    except Exception as exc:
        print(f"Kunne ikke hente høydedata fra Kartverket, bruker fallback: {exc}")
        return [_get_open_meteo_elevation(lat, lng) for lat, lng in point_list]


def get_elevation(lat: float, lng: float) -> float:
    return get_elevations([(lat, lng)])[0]
