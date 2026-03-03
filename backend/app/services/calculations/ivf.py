import math
from app.services.calculations.models import IVFData
from app.services.calculations.constants import STANDARD_VARIGHETER

def interpoler_ivf_intensitet(ivf_data: IVFData, returperiode_ar: int,
                               varighet_min: float) -> float:

    if returperiode_ar not in ivf_data.data:
        # Finn nærmeste returperiode
        tilgjengelige = sorted(ivf_data.data.keys())
        returperiode_ar = min(tilgjengelige, key=lambda x: abs(x - returperiode_ar))

    tabell = ivf_data.data[returperiode_ar]
    varigheter = sorted(tabell.keys())

    # Eksakt treff
    if varighet_min in tabell:
        return tabell[varighet_min]

    # Interpoler logaritmisk
    under = max((v for v in varigheter if v <= varighet_min), default=varigheter[0])
    over = min((v for v in varigheter if v >= varighet_min), default=varigheter[-1])

    if under == over:
        return tabell[under]

    # Log-lineær interpolasjon
    frac = (math.log(varighet_min) - math.log(under)) / (math.log(over) - math.log(under))
    return tabell[under] + frac * (tabell[over] - tabell[under])


def lag_ivf_data(stasjon: str, periode: str, tabell: dict) -> IVFData:
    return IVFData(stasjon=stasjon, periode=periode, data=tabell)


OSLO_BLINDERN_IVF = lag_ivf_data(
    stasjon="OSLO - BLINDERN PLU (SN18701)",
    periode="1968 - 2020",
    tabell={
        2:   {10: 119.9, 15: 94.3,  20: 80.8,  30: 63.3,  45: 48.6,  60: 40.5,  90: 30.7,  120: 25.8, 180: 19.8, 360: 12.2, 720: 7.4,  1440: 4.5},
        5:   {10: 176.0, 15: 141.0, 20: 122.6, 30: 94.7,  45: 72.6,  60: 59.9,  90: 44.6,  120: 36.5, 180: 27.4, 360: 16.5, 720: 9.7,  1440: 5.8},
        10:  {10: 215.5, 15: 175.3, 20: 153.1, 30: 118.1, 45: 91.7,  60: 74.8,  90: 55.1,  120: 44.4, 180: 32.8, 360: 19.4, 720: 11.3, 1440: 6.6},
        20:  {10: 255.0, 15: 209.5, 20: 184.3, 30: 142.8, 45: 111.6, 60: 91.1,  90: 66.2,  120: 52.7, 180: 38.4, 360: 22.3, 720: 12.9, 1440: 7.5},
        25:  {10: 267.4, 15: 221.0, 20: 194.6, 30: 151.2, 45: 118.7, 60: 96.5,  90: 69.8,  120: 55.4, 180: 40.2, 360: 23.2, 720: 13.5, 1440: 7.8},
        50:  {10: 307.2, 15: 258.1, 20: 229.8, 30: 178.9, 45: 141.9, 60: 115.3, 90: 82.2,  120: 64.1, 180: 46.2, 360: 26.1, 720: 15.3, 1440: 8.7},
        100: {10: 350.3, 15: 298.4, 20: 266.9, 30: 209.5, 45: 168.1, 60: 135.9, 90: 95.9,  120: 73.5, 180: 52.4, 360: 29.1, 720: 17.1, 1440: 9.6},
        200: {10: 394.5, 15: 341.7, 20: 308.2, 30: 241.6, 45: 197.7, 60: 159.4, 90: 111.2, 120: 83.9, 180: 59.4, 360: 32.1, 720: 19.1, 1440: 10.6},
    }
)