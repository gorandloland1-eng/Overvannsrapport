from app.services.calculations.ivf import interpoler_ivf_intensitet
from app.services.calculations.constants import STANDARD_VARIGHETER
from pydantic import BaseModel


class AronKiblerRequest(BaseModel):
    areal_ha: float
    phi: float
    konsentrasjonstid_min: float
    returperiode_ar: int
    klimafaktor: float
    maks_paslipp_l_s: float = 0.0
    infiltrasjonskapasitet_l_s: float = 0.0


def beregn_innlopsvolum(
    areal_ha: float,
    phi: float,
    intensitet_l_s_ha: float,
    varighet_min: float,
    klimafaktor: float
) -> float:
    """
    V_inn = phi * i * A * t * klimafaktor   [m³]
    """
    Q_ls = phi * intensitet_l_s_ha * areal_ha * klimafaktor
    return Q_ls * varighet_min * 60 / 1000


def beregn_utlopsvolum(
    maks_paslipp_l_s: float,
    varighet_min: float,
    infiltrasjonskapasitet_l_s: float = 0.0
) -> float:
    """
    V_ut = (Q_ut + Q_infiltrasjon) * t   [m³]
    """
    Q_total = maks_paslipp_l_s + infiltrasjonskapasitet_l_s
    return Q_total * varighet_min * 60 / 1000


def beregn_nodvendig_utjevningsvolum(
    V_inn: float,
    V_ut: float
) -> float:
    return max(0, V_inn - V_ut)


def aron_kibler_beregning(
    areal_ha: float,
    phi: float,
    konsentrasjonstid_min: float,
    returperiode_ar: int,
    klimafaktor: float,
    ivf_data,
    maks_paslipp_l_s: float = 0.0,
    infiltrasjonskapasitet_l_s: float = 0.0,
    varigheter_min: list | None = None
) -> dict:

    if varigheter_min is None:
        varigheter_min = STANDARD_VARIGHETER

    # Kun varigheter >= konsentrasjonstid
    aktive_varigheter = [
        v for v in varigheter_min if v >= konsentrasjonstid_min
    ]

    if not aktive_varigheter:
        aktive_varigheter = [
            min(varigheter_min, key=lambda x: abs(x - konsentrasjonstid_min))
        ]

    resultater = []

    for t in aktive_varigheter:
        i = interpoler_ivf_intensitet(ivf_data, returperiode_ar, t)

        V_inn = beregn_innlopsvolum(
            areal_ha,
            phi,
            i,
            t,
            klimafaktor
        )

        V_ut = beregn_utlopsvolum(
            maks_paslipp_l_s,
            t,
            infiltrasjonskapasitet_l_s
        )

        V_utj = beregn_nodvendig_utjevningsvolum(V_inn, V_ut)

        Q_inn_ls = phi * i * areal_ha * klimafaktor

        resultater.append({
            "varighet_min": t,
            "intensitet_l_s_ha": i,
            "Q_inn_l_s": Q_inn_ls,
            "V_inn_m3": V_inn,
            "V_ut_m3": V_ut,
            "utjevningsvolum_m3": V_utj,
        })

    # Finn dimensjonerende (maks volum)
    dim = max(resultater, key=lambda x: x["utjevningsvolum_m3"])

    V_inn_tk = beregn_innlopsvolum(
        areal_ha,
        phi,
        dim["intensitet_l_s_ha"],
        konsentrasjonstid_min,
        klimafaktor
    )

    fordroeyningsprosent = (
        dim["utjevningsvolum_m3"] / dim["V_inn_m3"]
        if dim["V_inn_m3"] > 0 else 0
    )

    paslipp_intensitet = (
        maks_paslipp_l_s / (phi * areal_ha)
        if phi * areal_ha > 0 else 0
    )

    return {
        "dim_varighet_min": dim["varighet_min"],
        "dim_intensitet_l_s_ha": dim["intensitet_l_s_ha"],
        "dim_Q_inn_l_s": dim["Q_inn_l_s"],
        "dim_utjevningsvolum_m3": dim["utjevningsvolum_m3"],
        "innlopsvolum_ved_tk_m3": V_inn_tk,
        "fordroeyningsprosent": fordroeyningsprosent,
        "paslipp_intensitet_l_s_ha": paslipp_intensitet,
        "areal_ha": areal_ha,
        "phi": phi,
        "konsentrasjonstid_min": konsentrasjonstid_min,
        "returperiode_ar": returperiode_ar,
        "klimafaktor": klimafaktor,
        "maks_paslipp_l_s": maks_paslipp_l_s,
        "infiltrasjonskapasitet_l_s": infiltrasjonskapasitet_l_s,
        "tabell": resultater,
    }


def beregn_alle_returperioder(
    areal_ha: float,
    phi: float,
    konsentrasjonstid_min: float,
    klimafaktor: float,
    ivf_data,
    maks_paslipp_l_s: float = 0.0,
    infiltrasjonskapasitet_l_s: float = 0.0,
    varigheter_min: list | None = None
) -> dict:

    resultater = {}

    for rp in sorted(ivf_data.data.keys()):
        resultater[rp] = aron_kibler_beregning(
            areal_ha=areal_ha,
            phi=phi,
            konsentrasjonstid_min=konsentrasjonstid_min,
            returperiode_ar=rp,
            klimafaktor=klimafaktor,
            ivf_data=ivf_data,
            maks_paslipp_l_s=maks_paslipp_l_s,
            infiltrasjonskapasitet_l_s=infiltrasjonskapasitet_l_s,
            varigheter_min=varigheter_min,
        )

    return resultater