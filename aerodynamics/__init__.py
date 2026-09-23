from __future__ import annotations

from typing import Any, Callable

from .common import CalculationError
from .fanno import solve as fanno
from .isentropic import solve as isentropic
from .natural_convection import solve as natural_convection
from .normal_shock import solve as normal_shock
from .oblique_shock import solve as oblique_shock
from .prandtl_meyer import solve as prandtl_meyer
from .rayleigh import solve as rayleigh

Solver = Callable[..., dict[str, float]]

CALCULATORS: dict[str, Solver] = {
    "isentropic": isentropic,
    "normal-shock": normal_shock,
    "oblique-shock": oblique_shock,
    "prandtl-meyer": prandtl_meyer,
    "fanno": fanno,
    "rayleigh": rayleigh,
    "natural-convection": natural_convection,
}


def calculate(calculator_id: str, inputs: dict[str, Any]) -> dict[str, Any]:
    solver = CALCULATORS.get(calculator_id)
    if solver is None:
        return {"ok": False, "error": {"code": "unknown_calculator", "message": "Unknown calculator."}}
    try:
        values = solver(**inputs)
        return {"ok": True, "values": values, "warnings": []}
    except CalculationError as error:
        return {"ok": False, "error": {"code": error.code, "message": error.message}}
    except (TypeError, ValueError, OverflowError) as error:
        return {"ok": False, "error": {"code": "invalid_input", "message": str(error)}}


__all__ = ["CALCULATORS", "calculate"]
