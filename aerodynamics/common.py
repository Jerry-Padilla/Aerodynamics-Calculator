from __future__ import annotations

import math
from typing import Callable


class CalculationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def require(condition: bool, message: str, code: str = "invalid_input") -> None:
    if not condition:
        raise CalculationError(code, message)


def validate_gas(mach: float, gamma: float, *, supersonic: bool = False) -> None:
    require(math.isfinite(mach) and mach > 0, "Mach number must be greater than zero.")
    require(math.isfinite(gamma) and gamma > 1, "Specific heat ratio γ must be greater than 1.")
    if supersonic:
        require(mach > 1, "This model requires a supersonic upstream Mach number.")


def bisect(function: Callable[[float], float], low: float, high: float, *, tolerance: float = 1e-10, iterations: int = 200) -> tuple[float, int]:
    f_low = function(low)
    f_high = function(high)
    require(math.isfinite(f_low) and math.isfinite(f_high), "Solver bounds produced a non-finite value.", "convergence")
    require(f_low == 0 or f_high == 0 or f_low * f_high < 0, "No physical solution exists within the selected branch.", "domain")
    for iteration in range(1, iterations + 1):
        midpoint = (low + high) / 2
        f_mid = function(midpoint)
        if abs(f_mid) <= tolerance or abs(high - low) <= tolerance:
            return midpoint, iteration
        if f_low * f_mid <= 0:
            high = midpoint
        else:
            low = midpoint
            f_low = f_mid
    raise CalculationError("convergence", "The numerical solver did not converge.")

