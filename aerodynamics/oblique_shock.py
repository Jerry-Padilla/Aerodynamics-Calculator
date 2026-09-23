from __future__ import annotations

import math

from .common import CalculationError, bisect, require, validate_gas
from .normal_shock import solve as normal_shock


def _theta_for_beta(beta: float, mach: float, gamma: float) -> float:
    numerator = 2 / math.tan(beta) * (mach * mach * math.sin(beta) ** 2 - 1)
    denominator = mach * mach * (gamma + math.cos(2 * beta)) + 2
    return math.atan(numerator / denominator)


def solve(mach: float, theta_deg: float, gamma: float) -> dict[str, float]:
    validate_gas(mach, gamma, supersonic=True)
    require(math.isfinite(theta_deg) and theta_deg > 0, "Deflection angle must be greater than zero.")
    theta = math.radians(theta_deg)
    mach_angle = math.asin(1 / mach)
    samples = 1200
    betas = [mach_angle + (math.pi / 2 - mach_angle) * index / samples for index in range(1, samples)]
    theta_values = [_theta_for_beta(beta, mach, gamma) for beta in betas]
    peak_index = max(range(len(theta_values)), key=theta_values.__getitem__)
    theta_max = theta_values[peak_index]
    if theta >= theta_max:
        raise CalculationError("detached_shock", f"No attached shock exists above θmax = {math.degrees(theta_max):.3f}°.")

    residual = lambda beta: _theta_for_beta(beta, mach, gamma) - theta
    weak, weak_iterations = bisect(residual, mach_angle + 1e-10, betas[peak_index])
    strong, strong_iterations = bisect(residual, betas[peak_index], math.pi / 2 - 1e-10)

    def branch(beta: float) -> tuple[dict[str, float], float]:
        normal = normal_shock(mach * math.sin(beta), gamma)
        downstream = normal["mach_2"] / math.sin(beta - theta)
        return normal, downstream

    weak_values, mach_weak = branch(weak)
    strong_values, mach_strong = branch(strong)
    return {
        "beta_weak_deg": math.degrees(weak),
        "beta_strong_deg": math.degrees(strong),
        "theta_max_deg": math.degrees(theta_max),
        "mach_2_weak": mach_weak,
        "mach_2_strong": mach_strong,
        "p2_p1_weak": weak_values["p2_p1"],
        "p2_p1_strong": strong_values["p2_p1"],
        "t2_t1_weak": weak_values["t2_t1"],
        "t2_t1_strong": strong_values["t2_t1"],
        "rho2_rho1_weak": weak_values["rho2_rho1"],
        "rho2_rho1_strong": strong_values["rho2_rho1"],
        "p02_p01_weak": weak_values["p02_p01"],
        "p02_p01_strong": strong_values["p02_p01"],
        "iterations": max(weak_iterations, strong_iterations),
    }

