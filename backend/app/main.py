from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from app.schemas.schemas import WeatherStation
import os
from app.services.elevation import get_elevation
from app.utils.haversine_distance import haversine_distance
from app.schemas.schemas import TwoPointRequest
from app.services.calculations.konsentrasjonstid_kirpich import konsentrasjonstid_kirpich

from app.aron_kibler import AronKiblerRequest
from app.aron_kibler import aron_kibler_beregning
from app.services.calculations.ivf import OSLO_BLINDERN_IVF

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


# --- PDF generation --- #
@app.post("/generate-pdf/{project_name}")
def generate_pdf(project_name: str):

    filepath = generate_project_pdf(project_name)

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=os.path.basename(filepath)
    )

@app.post("/calculate-terrain")
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