def beregn_midlere_avrenningsfaktor(arealposter: list, avrenningsfaktorer: dict) -> tuple:
    total_areal = sum(p.areal_m2 for p in arealposter)
    if total_areal == 0:
        return 0, 0

    vektet_sum = sum(
        p.areal_m2 * p.get_avrenningsfaktor(avrenningsfaktorer)
        for p in arealposter
    )

    return total_areal, vektet_sum / total_areal