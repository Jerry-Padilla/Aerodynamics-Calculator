from __future__ import annotations

import math

from .common import validate_gas
from .isentropic import solve as isentropic


def solve(mach: float, gamma: float) -> dict[str, float]:
    validate_gas(mach, gamma, supersonic=True)
    mach_2 = math.sqrt((1 + (gamma - 1) * mach * mach / 2) / (gamma * mach * mach - (gamma - 1) / 2))
    pressure = 1 + 2 * gamma * (mach * mach - 1) / (gamma + 1)
    density = (gamma + 1) * mach * mach / ((gamma - 1) * mach * mach + 2)
    temperature = pressure / density
    stagnation_pressure = pressure * isentropic(mach_2, gamma)["p0_p"] / isentropic(mach, gamma)["p0_p"]
    return {
        "mach_2": mach_2,
        "p2_p1": pressure,
        "t2_t1": temperature,
        "rho2_rho1": density,
        "p02_p01": stagnation_pressure,
    }

