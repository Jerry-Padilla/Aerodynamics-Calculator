# CD Nozzle Visualization Design

## Purpose

Add an original, interactive converging-diverging nozzle calculator to AEROCALC. The feature will use the Virginia Tech educational simulator only as a conceptual reference for the engineering information worth communicating. It will not reuse that simulator's source code, MATLAB implementation, wording, layout, or visual assets.

The result is an educational one-dimensional compressible-flow visualization based on AEROCALC's analytical Python solver. It must never be described as CFD.

## Scope

The existing **Isentropic flow** calculator remains unchanged as a point-state calculator. A new **CD Nozzle** calculator is added to the flow library with these inputs:

- Exit-to-throat area ratio, `Ae/At`
- Back-pressure-to-reservoir-pressure ratio, `pb/p0`
- Specific-heat ratio, `gamma`

The first implementation supports the regimes that a quasi-one-dimensional calorically perfect-gas model can determine:

- `subsonic`
- `choked`
- `internal_shock`
- `shock_at_exit`
- `design`
- `overexpanded`
- `underexpanded`

External compression and expansion structures are qualitative analytical indications of exit-pressure mismatch. The application will not claim to resolve their detailed geometry.

## Numerical Model

### Geometry

The solver constructs a deterministic smooth area distribution over normalized axial position `x/L` in `[0, 1]`. The throat is fixed at `x/L = 0.4` so the converging and diverging sections remain visually distinct. The distribution is monotonic on each side of the throat and satisfies:

- `A/At = inletAreaRatio` at `x/L = 0`
- `A/At = 1` at the throat
- `A/At = Ae/At` at `x/L = 1`

The inlet area ratio is a documented display-domain constant large enough to show the converging section without becoming another user control. Smoothstep interpolation provides zero slope at the inlet, throat, and exit. Geometry samples and state samples share the exact same `x/L` values.

### Core relations

The Python solver owns all compressible-flow calculations. It reuses or extracts common implementations of:

- Isentropic area-Mach relation
- Static-to-stagnation pressure relation
- Subsonic and supersonic area-Mach inversion by bounded root finding
- Normal-shock downstream Mach, static-pressure rise, and stagnation-pressure loss

No substantial solver equations are duplicated in TypeScript.

### Operating regimes

For a selected `Ae/At` and `gamma`, the solver calculates the relevant limiting back-pressure ratios:

1. The pressure ratio for the wholly subsonic solution that reaches Mach 1 at the throat.
2. The pressure ratio for a normal shock at the exit.
3. The isentropic supersonic design exit-pressure ratio.

The requested `pb/p0` is compared with these limits using explicit numerical tolerances:

- Above the choking boundary: wholly subsonic solution.
- At the choking boundary: sonic throat with a subsonic diverging branch.
- Between choking and shock-at-exit boundaries: supersonic flow downstream of the throat, an internal normal shock, then a subsonic solution to the exit.
- At the shock-at-exit boundary: isentropic supersonic internal solution with the shock marker at `x/L = 1` and post-shock exit state.
- Between shock-at-exit and design: isentropic supersonic internal solution classified as overexpanded.
- At the design ratio: isentropic supersonic solution with no external correction indication.
- Below design: isentropic supersonic internal solution classified as underexpanded.

Boundary equality uses scale-aware tolerances so regime labels do not flicker because of floating-point noise.

### Internal shock location

For the `internal_shock` regime, the solver finds shock area ratio by bounded bisection between the throat and exit. Each trial:

1. Solves the upstream supersonic Mach from the local `A/At`.
2. Applies normal-shock relations.
3. Computes downstream stagnation-pressure loss.
4. Determines the downstream effective critical area.
5. Solves the subsonic branch from the shock to the exit.
6. Compares predicted exit pressure with the specified back pressure.

The converged shock area is mapped back to the geometry's normalized axial coordinate. The returned profile contains paired pre-shock and post-shock points at the same `x/L`, preserving the physical discontinuity in both Mach and pressure paths.

### Response contract

The calculation result retains the existing scalar `values` object for cards and adds optional structured profile data:

```ts
type NozzleRegime =
  | 'subsonic'
  | 'choked'
  | 'internal_shock'
  | 'shock_at_exit'
  | 'design'
  | 'overexpanded'
  | 'underexpanded'

type NozzleProfilePoint = {
  x: number
  areaRatio: number
  mach: number
  pressureRatio: number
  side?: 'pre_shock' | 'post_shock'
}

type NozzleProfile = {
  points: NozzleProfilePoint[]
  throatX: number
  shockX?: number
  regime: NozzleRegime
  limits: {
    chokingPressureRatio: number
    shockAtExitPressureRatio: number
    designPressureRatio: number
  }
  exit: {
    mach: number
    pressureRatio: number
    backPressureRatio: number
  }
}
```

Names may be adapted slightly to match serialization conventions, but their meanings remain explicit and typed.

## Application Architecture

The calculator registry receives a new `cd-nozzle` definition and input metadata. Python receives a focused nozzle module, while shared isentropic and normal-shock primitives remain the authoritative lower-level relations. The worker transports the JSON-compatible profile without interpretation.

The generic result cards display compact operating quantities such as exit Mach, exit pressure ratio, mass-flow/choking status where supported, and shock location when present. A nozzle-specific React component replaces `ResultPlot` only for `cd-nozzle`; every other calculator continues using the existing result display.

The visualization component consumes only the typed solver response. Its responsibilities are coordinate scales, SVG paths, labels, hover selection, and qualitative exit annotations.

## Visualization

One responsive engineering display contains vertically stacked panels with a shared plotting rectangle and normalized axial coordinate.

### Nozzle schematic

- Orange converging-diverging walls derived from returned `A/At` samples
- Thin centerline and left-to-right flow arrow
- Marked throat aligned with the lower plots
- Cyan-toned flow-region treatment
- A distinct red normal-shock marker only when returned by the solver
- Qualitative compression marks for overexpanded operation
- Qualitative expansion-fan marks for underexpanded operation
- No external correction marks at design operation

### Mach plot

- `x/L` horizontal axis and Mach vertical axis
- Cyan solver-generated profile
- Dashed horizontal reference at `M = 1`
- Shared throat marker
- Shock discontinuity drawn from paired pre/post-shock samples

### Pressure plot

- `x/L` horizontal axis and `p/p0` vertical axis
- Cyan solver-generated profile
- Shared throat and shock markers
- Abrupt pressure increase across an internal or exit normal shock
- Exit pressure and back pressure identified when mismatched

### Area guide

A compact orange `A/At` guide may be integrated into the schematic rather than added as a fourth full plot. It must remain readable on narrow screens and must not obscure the more important Mach and pressure panels.

### Shared interaction

Pointer movement over any panel selects the nearest axial sample. One vertical cursor is rendered at the same horizontal location in every panel. A compact readout presents:

- `x/L`
- `A/At`
- `M`
- `p/p0`

At a shock coordinate, the readout distinguishes upstream and downstream states. Keyboard focus on the visualization exposes equivalent sample navigation so the information is not pointer-only.

### Visual language

The component follows the existing AEROCALC design language:

- Dark background and thin technical grid
- Cyan flow and data curves
- Orange geometry
- Red shock emphasis
- IBM Plex Mono engineering labels
- SVG `viewBox` scaling for responsive rendering

It does not imitate the legacy MATLAB interface.

## Accessibility and Explanatory Copy

The SVG has an accessible title and description containing the current regime. A nearby textual operating summary states the regime, whether the throat is sonic, whether a normal shock is present, and how exit pressure compares with back pressure. Color is never the sole carrier of regime or shock information.

Copy consistently calls the feature a one-dimensional analytical nozzle model. External marks are labeled as qualitative wave indications.

## Error Handling

The Python solver returns existing structured errors for:

- `Ae/At <= 1`
- `pb/p0` outside `(0, 1]`
- `gamma <= 1`
- Failed root bracketing or convergence
- Non-finite inputs or intermediate results

The React application uses the existing error state and does not attempt to render incomplete profile data. The profile type is optional on the shared result contract so older and unrelated calculators remain compatible.

## Testing and Scientific Validation

### Python tests

Tests cover:

- Area-Mach inversion on subsonic and supersonic branches
- Sampled geometry endpoints, monotonic sections, and exact throat
- Wholly subsonic operation
- Choking boundary and `M = 1` at the throat
- Supersonic design operation
- Internal-shock convergence and axial position
- Pre/post-shock Mach and pressure jumps against normal-shock relations
- Shock-at-exit boundary
- Overexpanded and underexpanded classification
- Pressure and input validation failures
- Boundary tolerance stability

Reference values are checked against the documented perfect-gas relations and independent authoritative examples where available. Scientific validation notes are expanded with equations, regime definitions, tolerances, and model limitations.

### React tests

Tests cover:

- CD Nozzle navigation and inputs
- Nozzle-specific display selection
- SVG paths derived from supplied profile points
- Aligned throat and shock markers
- Shared hover/readout behavior
- Regime labels and permitted external-wave annotations
- Textual operating summary and accessible SVG naming
- Existing calculators retaining the generic plot

### Completion verification

Before completion, run the full Python tests, frontend tests, TypeScript lint, production build, and a visual browser check at desktop and narrow viewport widths.

## Out of Scope

- CFD or multidimensional flow-field prediction
- Boundary layers, viscous separation, side loads, or unsteady shocks
- Detailed external shock-cell geometry
- Real-gas or variable-specific-heat effects
- User-defined nozzle contours beyond `Ae/At`
- Modifying the existing Isentropic calculator's meaning or inputs
