from __future__ import annotations

from .common import require


def solve(surface_temperature_k: float, ambient_temperature_k: float, thermal_diffusivity_m2_s: float, kinematic_viscosity_m2_s: float, characteristic_length_m: float) -> dict[str, float]:
    require(surface_temperature_k > 0 and ambient_temperature_k > 0, "Absolute temperatures must be positive.")
    require(thermal_diffusivity_m2_s > 0 and kinematic_viscosity_m2_s > 0 and characteristic_length_m > 0, "Fluid properties and characteristic length must be positive.")
    film_temperature = (surface_temperature_k + ambient_temperature_k) / 2
    buoyancy = 9.80665 * (surface_temperature_k - ambient_temperature_k) * characteristic_length_m ** 3 / film_temperature
    grashof = buoyancy / kinematic_viscosity_m2_s ** 2
    rayleigh = buoyancy / (thermal_diffusivity_m2_s * kinematic_viscosity_m2_s)
    return {"film_temperature_k": film_temperature, "rayleigh": rayleigh, "grashof": grashof}

