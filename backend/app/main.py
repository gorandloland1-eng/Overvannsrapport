from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from app.schemas.schemas import WeatherStation
import os

from app.aron_kibler import AronKiblerRequest
from app.aron_kibler import aron_kibler_beregning
from app.services.calculations.ivf import OSLO_BLINDERN_IVF
#from app.matrikkel_api import router as matrikkel_router

from fastapi.responses import FileResponse
from app.pdf_generator import generate_project_pdf

app = FastAPI()
#app.include_router(matrikkel_router)

CLIENT_ID = "4d96f374-2aff-4bfd-a7be-d7522cc7bbc5"
OUTPUT_FOLDER = "output"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {"Hello!!"}


# -- Aron kibler endpoint --- #
@app.post("/aron-kibler")
def calculate(request: AronKiblerRequest):

    result = aron_kibler_beregning(
        areal_ha=request.areal_ha,
        phi=request.phi,
        konsentrasjonstid_min=request.konsentrasjonstid_min,
        returperiode_ar=request.returperiode_ar,
        klimafaktor=request.klimafaktor,
        ivf_data=OSLO_BLINDERN_IVF,
        maks_paslipp_l_s=request.maks_paslipp_l_s,
        infiltrasjonskapasitet_l_s=request.infiltrasjonskapasitet_l_s,
    )

    return result


# --- Weather station endpoint --- #
@app.get("/weather-stations", response_model=list[WeatherStation])
def get_weather_stations():
    response = requests.get(
    "https://frost.met.no/sources/v0.jsonld",
    auth=(CLIENT_ID, ""),
    params={
        "country": "NO",
    }
)
    print(response.status_code)
    print(response.json())

    data = response.json()

    result = []
    for item in data.get("data", []):
        station_id = item.get("id")
        name = item.get("name")
        geom = item.get("geometry")
        if geom and "coordinates" in geom:
            lng, lat = geom["coordinates"]
        else:
            lat = 0
            lng = 0
        result.append(WeatherStation(id=station_id, name=name, lat=lat, lng=lng))

    return result

# --- PDF generation --- #
@app.post("/generate-pdf/{project_name}")
def generate_pdf(project_name: str):

    filepath = generate_project_pdf(project_name)

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=os.path.basename(filepath)
    )