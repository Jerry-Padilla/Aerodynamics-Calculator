from __future__ import annotations

import math

from .common import CalculationError, bisect, require, validate_gas


def _parameter(mach: float, gamma: float) -> float:
    return (1 - mach * mach) / (gamma * mach * mach) + (gamma + 1) / (2 * gamma) * math.log((gamma + 1) * mach * mach / (2 + (gamma - 1) * mach * mach))


def solve(mach: float, friction_factor: float, length_m: float, diameter_m: float, gamma: float) -> dict[str, float]:
    validate_gas(mach, gamma)
    require(mach != 1, "The inlet is already at the sonic Fanno condition.")
    require(friction_factor >= 0 and length_m >= 0 and diameter_m > 0, "Friction factor and length must be non-negative, and diameter must be positive.")
    consumed = 4 * friction_factor * length_m / diameter_m
    available = _parameter(mach, gamma)
    if consumed > available + 1e-12:
        raise CalculationError("choked", "The requested duct friction exceeds the distance to the sonic condition.")
    target = max(0.0, available - consumed)
    if target == 0:
        mach_2, iterations = 1.0, 0
    elif mach < 1:
        mach_2, iterations = bisect(lambda value: _parameter(value, gamma) - target, mach, 1.0)
    else:
        mach_2, iterations = bisect(lambda value: _parameter(value, gamma) - target, 1.0, mach)
    return {
        "mach_2": mach_2,
        "fanno_available": available,
        "friction_consumed": consumed,
        "remaining_to_sonic": target,
        "iterations": iterations,
    }

