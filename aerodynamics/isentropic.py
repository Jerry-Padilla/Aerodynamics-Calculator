from __future__ import annotations

from .common import validate_gas


def solve(mach: float, gamma: float) -> dict[str, float]:
    validate_gas(mach, gamma)
    temperature = 1 + (gamma - 1) * mach * mach / 2
    return {
        "t0_t": temperature,
        "p0_p": temperature ** (gamma / (gamma - 1)),
        "rho0_rho": temperature ** (1 / (gamma - 1)),
        "area_ratio": (1 / mach) * ((2 / (gamma + 1)) * temperature) ** ((gamma + 1) / (2 * (gamma - 1))),
    }

