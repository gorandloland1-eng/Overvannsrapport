import requests

def get_elevation(lat: float, lng: float) -> float:
    response = requests.get(
        "https://api.open-meteo.com/v1/elevation",
        params={
            "latitude": lat,
            "longitude": lng
        }
    )

    data = response.json()

    return data["elevation"][0]