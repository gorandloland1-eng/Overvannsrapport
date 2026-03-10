from fastapi import APIRouter
from app.schemas.schemas import AronKiblerRequest
from app.aron_kibler import aron_kibler_beregning
from app.services.calculations.ivf import OSLO_BLINDERN_IVF

router = APIRouter()

@router.post("/aron-kibler")
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
