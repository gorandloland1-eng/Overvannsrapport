from fastapi import APIRouter
from app.schemas.schemas import TwoPointRequest
from app.services.elevation import get_elevation
from app.utils.haversine_distance import haversine_distance
from app.services.calculations.konsentrasjonstid_kirpich import konsentrasjonstid_kirpich

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

    print(f"{'='*30}")
    print("Terrengdata:")
    print(f"  Høyde 1: {elev1}")
    print(f"  Høyde 2: {elev2}")
    print(f"  Lengde: {lengde}")


    print("------------------------------")

    print(f"  Høydeforskjell: {hoydeforskjell} m")
    print(f"  Lengde: {lengde} m")
    print(f"  Konsentrasjonstid: {tc} min")
    print(f"{'='*30}")

    return {
        "lengde_m": lengde,
        "hoydeforskjell_m": hoydeforskjell,
        "konsentrasjonstid_min": tc
    }
