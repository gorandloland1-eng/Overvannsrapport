def calculate_rectangular_basin_water_level (
    utjevningsvolum_m3: float,
    areal_bunnflate_m2: float
) -> float:
    
    if areal_bunnflate_m2 <= 0:
        return 0
    return utjevningsvolum_m3 / areal_bunnflate_m2