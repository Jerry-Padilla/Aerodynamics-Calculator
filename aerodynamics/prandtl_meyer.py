from __future__ import annotations

import math

from .common import CalculationError, bisect, require, validate_gas


def _nu(mach: float, gamma: float) -> float:
    root = math.sqrt(mach * mach - 1)
    return math.sqrt((gamma + 1) / (gamma - 1)) * math.atan(math.sqrt((gamma - 1) / (gamma + 1)) * root) - math.atan(root)


def solve(mach: float, theta_deg: float, gamma: float) -> dict[str, float]:
    validate_gas(mach, gamma, supersonic=True)
    require(math.isfinite(theta_deg) and theta_deg > 0, "Expansion angle must be greater than zero.")
    target = _nu(mach, gamma) + math.radians(theta_deg)
    maximum = math.pi / 2 * (math.sqrt((gamma + 1) / (gamma - 1)) - 1)
    if target >= maximum:
        raise CalculationError("domain", "The requested expansion exceeds the maximum Prandtl–Meyer angle.")
    upper = max(2 * mach, 4.0)
    while _nu(upper, gamma) < target and upper < 1e6:
        upper *= 2
    mach_2, iterations = bisect(lambda value: _nu(value, gamma) - target, mach, upper)
    return {
        "mach_2": mach_2,
        "nu_1_deg": math.degrees(_nu(mach, gamma)),
        "nu_2_deg": math.degrees(target),
        "mach_angle_1_deg": math.degrees(math.asin(1 / mach)),
        "mach_angle_2_deg": math.degrees(math.asin(1 / mach_2)),
        "iterations": iterations,
    }

