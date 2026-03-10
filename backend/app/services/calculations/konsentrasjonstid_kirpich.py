import math

def konsentrasjonstid_kirpich(
    lengde_m: float,
    hoydeforskjell_m: float
) -> float:

    if lengde_m <= 0 or hoydeforskjell_m <= 0:
        return 5.0  # Minimum iht praksis

    stigning = hoydeforskjell_m / lengde_m

    if stigning <= 0:
        return 5.0

    tc = 0.0663 * (lengde_m ** 0.77) / (stigning ** 0.385)

    return max(tc, 10.0)