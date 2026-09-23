from __future__ import annotations

import math

from .common import CalculationError, bisect, require, validate_gas


def _t0_ratio(mach: float, gamma: float) -> float:
    return ((gamma + 1) * mach * mach / (1 + gamma * mach * mach) ** 2) * (2 + (gamma - 1) * mach * mach)


def solve(mach: float, temperature_k: float, gamma: float, cp_j_kgk: float, heat_j_kg: float) -> dict[str, float]:
    validate_gas(mach, gamma)
    require(mach != 1, "The inlet is already at the sonic Rayleigh condition.")
    require(temperature_k > 0 and cp_j_kgk > 0, "Temperature and specific heat must be positive.")
    stagnation_1 = temperature_k * (1 + (gamma - 1) * mach * mach / 2)
    stagnation_2 = stagnation_1 + heat_j_kg / cp_j_kgk
    require(stagnation_2 > 0, "Heat removal would produce a non-physical stagnation temperature.", "domain")
    target = stagnation_2 / stagnation_1 * _t0_ratio(mach, gamma)
    if target > 1 + 1e-10:
        raise CalculationError("choked", "Heat addition exceeds the Rayleigh choking limit.")
    target = min(target, 1.0)
    if abs(target - 1) < 1e-10:
        mach_2, iterations = 1.0, 0
    elif mach < 1:
        mach_2, iterations = bisect(lambda value: _t0_ratio(value, gamma) - target, 1e-7, 1 - 1e-9)
    else:
        upper = max(2 * mach, 4.0)
        while _t0_ratio(upper, gamma) > target and upper < 1e6:
            upper *= 2
        mach_2, iterations = bisect(lambda value: _t0_ratio(value, gamma) - target, 1 + 1e-9, upper)

    p_star = lambda value: (gamma + 1) / (1 + gamma * value * value)
    t_star = lambda value: value * value * p_star(value) ** 2
    rho_star = lambda value: (1 + gamma * value * value) / ((gamma + 1) * value * value)
    return {
        "mach_2": mach_2,
        "stagnation_temperature_1_k": stagnation_1,
        "stagnation_temperature_2_k": stagnation_2,
        "p2_p1": p_star(mach_2) / p_star(mach),
        "t2_t1": t_star(mach_2) / t_star(mach),
        "rho2_rho1": rho_star(mach_2) / rho_star(mach),
        "iterations": iterations,
    }

