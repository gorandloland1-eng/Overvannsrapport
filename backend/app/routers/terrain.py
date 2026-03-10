from fastapi import APIRouter
from app.schemas.schemas import TwoPointRequest

router = APIRouter()

@router.post("/calculate-terrain")
def calculate_terrain(data: TwoPointRequest):

    elev1 = get_elevation(data.lat1, data.lng1)
    elev2 = get_elevation(data.lat2, data.lng2)

    hoydeforskjell = abs(elev1 - elev2)

    lengde = haversine_distance(
        data.lat1, data.lng1,
        data.lat2, data.lng2
    )

    tc = konsentrasjonstid_kirpich(lengde, hoydeforskjell)

    return {
        "lengde_m": lengde,
        "hoydeforskjell_m": hoydeforskjell,
        "konsentrasjonstid_min": tc
    }
