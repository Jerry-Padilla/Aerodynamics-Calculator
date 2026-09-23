# Scientific validation notes

`calculations.m` is retained as project history only. It is **not** the numerical specification for this application. The Python implementation was re-derived from standard perfect-gas relations and given explicit physical domains.

## Sources and conventions

- Isentropic state and area ratios follow [NASA Glenn's isentropic-flow equations](https://www.grc.nasa.gov/www/k-12/airplane/isentrop.html).
- Normal-shock state and total-pressure ratios follow [NASA Glenn's normal-shock equations](https://www.grc.nasa.gov/WWW/k-12/airplane/normal.html).
- Oblique shocks use the theta-beta-M relation and apply normal-shock relations to the normal Mach component, consistent with [NACA Report 1135](https://www.grc.nasa.gov/www/k-12/airplane/Images/naca1135.pdf).
- Prandtl–Meyer, Fanno, and Rayleigh calculations use the calorically-perfect-gas relations collected in NACA Report 1135. Root finding is bracketed by the physical subsonic or supersonic branch.
- Natural convection uses `Gr = g β ΔT L³ / ν²`, `Ra = Gr·Pr = g β ΔT L³/(ν α)`, and the ideal-gas approximation `β = 1/Tfilm`.

## Corrections and deliberate differences from MATLAB

- The MATLAB oblique-shock Newton derivative and initial guess are not used. The web implementation locates the maximum turning angle, reports detached shocks, and bisects both attached branches.
- The Prandtl–Meyer inversion uses bounded bisection rather than the unverified Newton derivative in the original script.
- Fanno flow explicitly uses the Fanning-factor convention `4 f L / D`. Inputs that pass the sonic limit return a structured `choked` error.
- Rayleigh flow assigns results on every converged path, validates positive stagnation temperature, and reports heat-addition choking.
- The MATLAB sample `alpha = 0.02808` has the magnitude of thermal conductivity, not air thermal diffusivity. Because the implemented Rayleigh-number equation requires diffusivity, the UI default is `2.808×10⁻⁵ m²/s`. Users must supply properties appropriate to their fluid and film temperature.

## Automated benchmarks

`tests/test_aerodynamics.py` pins reference values for all seven calculators, including isentropic and normal-shock ratios at `M=2`, both oblique-shock branches at `M₁=2.5` and `θ=15°`, a `10°` Prandtl–Meyer expansion from `M₁=2`, and Fanno, Rayleigh, and natural-convection states. It also exercises detached-shock, friction-choking, invalid-gamma, and unknown-model errors.

These calculators assume one-dimensional or planar textbook models. They are not CFD, do not model real-gas effects, and require independent engineering review for safety-critical work.
