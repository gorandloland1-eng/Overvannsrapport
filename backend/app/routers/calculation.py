from fastapi import APIRouter, HTTPException
from app.schemas.schemas import AronKiblerRequest
from app.services.calculations.aron_kibler import aron_kibler_beregning
from app.services.calculations.ivf import OSLO_BLINDERN_IVF
from app.services.calculations.constants import HYDRAULISK_KONDUKTIVITET
from app.services.calculations.models import InfiltrasjonData

router = APIRouter()


@router.get("/jordtyper")
def get_jordtyper():
    return [
        {"id": navn, "navn": navn, "k_m_s": data["k_m_s"], "beskrivelse": data["beskrivelse"]}
        for navn, data in HYDRAULISK_KONDUKTIVITET.items()
    ]


@router.post("/aron-kibler")
def calculate(request: AronKiblerRequest):

    if request.jordtype is not None:
        if request.jordtype not in HYDRAULISK_KONDUKTIVITET:
            raise HTTPException(
                status_code=422,
                detail=f"Ukjent jordtype: {request.jordtype!r}",
            )
        k = HYDRAULISK_KONDUKTIVITET[request.jordtype]["k_m_s"]
        q_inf = InfiltrasjonData(
            hydraulisk_konduktivitet_m_s=k,
            areal_bunnflate_m2=request.areal_bunnflate_m2,
            areal_sideflater_m2=request.areal_sideflater_m2,
        ).infiltrasjonskapasitet_l_s
    else:
        q_inf = request.infiltrasjonskapasitet_l_s

    result = aron_kibler_beregning(
        areal_ha=request.areal_ha,
        phi=request.phi,
        konsentrasjonstid_min=request.konsentrasjonstid_min,
        returperiode_ar=request.returperiode_ar,
        klimafaktor=request.klimafaktor,
        ivf_data=OSLO_BLINDERN_IVF,
        maks_paslipp_l_s=request.maks_paslipp_l_s,
        infiltrasjonskapasitet_l_s=q_inf,
    )

    return result
