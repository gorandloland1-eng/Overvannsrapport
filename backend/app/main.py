from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.aron_kibler import AronKiblerRequest
from app.aron_kibler import aron_kibler_beregning
from app.services.calculations.ivf import OSLO_BLINDERN_IVF

app = FastAPI()

CLIENT_ID = "4d96f374-2aff-4bfd-a7be-d7522cc7bbc5"

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