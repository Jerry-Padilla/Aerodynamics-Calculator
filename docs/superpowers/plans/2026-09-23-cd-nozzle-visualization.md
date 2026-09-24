# CD Nozzle Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scientifically derived converging-diverging nozzle calculator with synchronized SVG geometry, Mach, and normalized-pressure profiles.

**Architecture:** A new Python `cd_nozzle` module classifies the operating regime and returns a sampled axial profile using shared isentropic and normal-shock primitives. React receives that JSON-compatible profile through the existing worker, renders it in a dedicated SVG component, and owns only presentation and interaction state.

**Tech Stack:** Python 3.11 `unittest`, React 18, TypeScript 5.7, SVG, Vitest, Testing Library, Pyodide Web Worker, Vite.

**Spec:** `docs/superpowers/specs/2026-09-23-cd-nozzle-visualization-design.md`

## Global Constraints

- Keep the existing Isentropic calculator's inputs and meaning unchanged.
- All nozzle distributions must come from the Python analytical solver; do not reproduce solver equations in TypeScript.
- Describe the model as one-dimensional analytical compressible flow, never CFD.
- Use a normalized axial coordinate shared exactly by the geometry, Mach, and pressure panels.
- External compression and expansion marks are qualitative indicators only.
- Preserve the existing AEROCALC dark visual language, IBM Plex Mono labels, cyan data, orange geometry, and distinct red shock emphasis.
- Do not copy the Virginia Tech simulator's code, wording, layout, or visual assets.

## Review Focus

- Back pressure within numerical tolerance of a regime boundary must produce a stable boundary label rather than flicker between regimes; Task 2 pins every boundary.
- An internal shock near either the throat or exit must remain bracketed and return finite paired shock samples; Task 2 includes near-boundary shock cases.
- Repeated `x` values at a shock must render a vertical discontinuity without breaking hover selection; Task 4 tests paired samples explicitly.
- A malformed or absent profile must not crash unrelated calculator results; Task 3 and Task 5 test optional profile handling.
- Keyboard users must be able to traverse the same sampled states exposed to pointer users; Task 4 tests focus and arrow-key navigation.

---

### Task 1: Extract reusable compressible-flow primitives

**Files:**
- Modify: `aerodynamics/isentropic.py`
- Modify: `aerodynamics/normal_shock.py`
- Modify: `tests/test_aerodynamics.py`

**Interfaces:**
- Produces: `area_ratio(mach: float, gamma: float) -> float`
- Produces: `pressure_ratio(mach: float, gamma: float) -> float` returning `p/p0`
- Produces: `mach_from_area(area: float, gamma: float, branch: str) -> float`
- Produces: `shock_state(mach_1: float, gamma: float) -> dict[str, float]`
- Preserves: `isentropic.solve()` and `normal_shock.solve()` response keys and numerical behavior.

- [ ] **Step 1: Add failing primitive tests**

Add imports and focused tests to `tests/test_aerodynamics.py`:

```python
from aerodynamics.isentropic import area_ratio, mach_from_area, pressure_ratio
from aerodynamics.normal_shock import shock_state

def test_area_mach_inversion_resolves_both_branches(self):
    self.assert_close(mach_from_area(1.6875, 1.4, "subsonic"), 0.3722444862)
    self.assert_close(mach_from_area(1.6875, 1.4, "supersonic"), 2.0)

def test_isentropic_pressure_ratio_is_static_over_stagnation(self):
    self.assert_close(pressure_ratio(2.0, 1.4), 1 / 7.8244490669)

def test_shared_shock_state_matches_public_solver(self):
    shared = shock_state(2.0, 1.4)
    public = calculate("normal-shock", {"mach": 2.0, "gamma": 1.4})["values"]
    for key in ("mach_2", "p2_p1", "p02_p01"):
        self.assert_close(shared[key], public[key])

def test_area_mach_inversion_rejects_invalid_branch(self):
    with self.assertRaisesRegex(ValueError, "branch"):
        mach_from_area(1.5, 1.4, "transonic")
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
python -m unittest tests.test_aerodynamics.AerodynamicsTests.test_area_mach_inversion_resolves_both_branches tests.test_aerodynamics.AerodynamicsTests.test_isentropic_pressure_ratio_is_static_over_stagnation tests.test_aerodynamics.AerodynamicsTests.test_shared_shock_state_matches_public_solver -v
```

Expected: import failures because the new functions do not exist.

- [ ] **Step 3: Implement minimal shared primitives**

In `aerodynamics/isentropic.py`, extract the current expressions and add bounded inversion:

```python
import math
from .common import bisect, require, validate_gas

def area_ratio(mach: float, gamma: float) -> float:
    validate_gas(mach, gamma)
    temperature = 1 + (gamma - 1) * mach * mach / 2
    return (1 / mach) * ((2 / (gamma + 1)) * temperature) ** ((gamma + 1) / (2 * (gamma - 1)))

def pressure_ratio(mach: float, gamma: float) -> float:
    validate_gas(mach, gamma)
    return (1 + (gamma - 1) * mach * mach / 2) ** (-gamma / (gamma - 1))

def mach_from_area(area: float, gamma: float, branch: str) -> float:
    require(math.isfinite(area) and area >= 1, "Area ratio A/A* must be at least 1.")
    require(branch in {"subsonic", "supersonic"}, "Area-Mach branch must be 'subsonic' or 'supersonic'.")
    if math.isclose(area, 1.0, rel_tol=0.0, abs_tol=1e-12):
        return 1.0
    low, high = ((1e-8, 1 - 1e-10) if branch == "subsonic" else (1 + 1e-10, 50.0))
    return bisect(lambda mach: area_ratio(mach, gamma) - area, low, high)[0]
```

Update `solve()` to call these helpers without changing its keys. In `aerodynamics/normal_shock.py`, move the existing calculation into `shock_state()` and make `solve()` validate then delegate to it.

- [ ] **Step 4: Run primitive tests and the full Python suite**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: all existing and new tests pass.

- [ ] **Step 5: Commit the primitive extraction**

```powershell
git add aerodynamics/isentropic.py aerodynamics/normal_shock.py tests/test_aerodynamics.py
git commit -m "refactor: share nozzle flow relations"
```

---

### Task 2: Implement and validate the Python nozzle operating-point solver

**Files:**
- Create: `aerodynamics/cd_nozzle.py`
- Modify: `aerodynamics/__init__.py`
- Modify: `tests/test_aerodynamics.py`
- Modify: `docs/scientific-validation.md`

**Interfaces:**
- Consumes: `area_ratio`, `pressure_ratio`, `mach_from_area`, `shock_state`, and `common.bisect` from Task 1.
- Produces: `cd_nozzle.solve(exit_area_ratio: float, back_pressure_ratio: float, gamma: float) -> dict[str, Any]`.
- Produces scalar keys: `exit_mach`, `exit_pressure_ratio`, `throat_mach`, and `shock_x`; textual regime belongs in `profile.regime`.
- Produces a camelCase `profile` with `points`, `throatX`, optional `shockX`, `regime`, `limits`, and `exit` exactly matching the TypeScript contract in the spec.

- [ ] **Step 1: Add failing geometry and design-condition tests**

Add tests that call the public dispatcher:

```python
def test_cd_nozzle_design_profile_is_supersonic_after_throat(self):
    ae_at, gamma = 2.5, 1.4
    exit_mach = mach_from_area(ae_at, gamma, "supersonic")
    design_pb = pressure_ratio(exit_mach, gamma)
    result = calculate("cd-nozzle", {
        "exit_area_ratio": ae_at,
        "back_pressure_ratio": design_pb,
        "gamma": gamma,
    })
    self.assertTrue(result["ok"])
    profile = result["profile"]
    self.assertEqual(profile["regime"], "design")
    self.assert_close(profile["throatX"], 0.4)
    self.assert_close(result["values"]["throat_mach"], 1.0)
    self.assert_close(result["values"]["exit_mach"], exit_mach)
    self.assert_close(profile["points"][0]["x"], 0.0)
    self.assert_close(profile["points"][-1]["x"], 1.0)
    throat = min(profile["points"], key=lambda point: abs(point["x"] - 0.4))
    self.assert_close(throat["areaRatio"], 1.0)
    self.assertTrue(all(point["mach"] > 1 for point in profile["points"] if point["x"] > 0.4))

def test_cd_nozzle_geometry_is_monotonic_on_each_side(self):
    result = calculate("cd-nozzle", {"exit_area_ratio": 2.5, "back_pressure_ratio": 0.05, "gamma": 1.4})
    points = result["profile"]["points"]
    converging = [point["areaRatio"] for point in points if point["x"] <= 0.4]
    diverging = [point["areaRatio"] for point in points if point["x"] >= 0.4]
    self.assertTrue(all(a >= b for a, b in zip(converging, converging[1:])))
    self.assertTrue(all(a <= b for a, b in zip(diverging, diverging[1:])))
```

- [ ] **Step 2: Run the design tests and verify RED**

Run:

```powershell
python -m unittest tests.test_aerodynamics.AerodynamicsTests.test_cd_nozzle_design_profile_is_supersonic_after_throat tests.test_aerodynamics.AerodynamicsTests.test_cd_nozzle_geometry_is_monotonic_on_each_side -v
```

Expected: failures with `unknown_calculator`.

- [ ] **Step 3: Implement geometry, limiting pressures, and isentropic regimes**

Create `aerodynamics/cd_nozzle.py` with constants `THROAT_X = 0.4`, `INLET_AREA_RATIO = 2.5`, `SAMPLE_COUNT = 81`, and `REGIME_TOLERANCE = 1e-7`. Implement:

```python
def smoothstep(value: float) -> float:
    return value * value * (3 - 2 * value)

def geometry_area(x: float, exit_area_ratio: float) -> float:
    if x <= THROAT_X:
        fraction = x / THROAT_X
        return INLET_AREA_RATIO + (1 - INLET_AREA_RATIO) * smoothstep(fraction)
    fraction = (x - THROAT_X) / (1 - THROAT_X)
    return 1 + (exit_area_ratio - 1) * smoothstep(fraction)
```

Add helpers for the subsonic solution, choked subsonic-diverging solution, and isentropic supersonic solution. Each returned point is a plain dictionary with snake_case keys that `calculate()` can serialize. Register `"cd-nozzle": cd_nozzle` in `aerodynamics/__init__.py`, and allow `calculate()` to lift a reserved `_profile` entry out of the solver response:

```python
values = solver(**inputs)
profile = values.pop("_profile", None)
response = {"ok": True, "values": values, "warnings": []}
if profile is not None:
    response["profile"] = profile
return response
```

- [ ] **Step 4: Run design tests and verify GREEN**

Run the two tests from Step 2. Expected: PASS.

- [ ] **Step 5: Add failing regime, shock, boundary, and validation tests**

Add tests that derive boundary inputs from one baseline solve rather than hardcoding implementation-specific thresholds:

```python
def nozzle_limits(self, ae_at=2.5, gamma=1.4):
    design = calculate("cd-nozzle", {"exit_area_ratio": ae_at, "back_pressure_ratio": 0.05, "gamma": gamma})
    return design["profile"]["limits"]

def test_cd_nozzle_classifies_all_pressure_regimes(self):
    limits = self.nozzle_limits()
    cases = [
        ((1 + limits["chokingPressureRatio"]) / 2, "subsonic"),
        (limits["chokingPressureRatio"], "choked"),
        ((limits["chokingPressureRatio"] + limits["shockAtExitPressureRatio"]) / 2, "internal_shock"),
        (limits["shockAtExitPressureRatio"], "shock_at_exit"),
        ((limits["shockAtExitPressureRatio"] + limits["designPressureRatio"]) / 2, "overexpanded"),
        (limits["designPressureRatio"], "design"),
        (limits["designPressureRatio"] / 2, "underexpanded"),
    ]
    for back_pressure, expected in cases:
        with self.subTest(expected):
            result = calculate("cd-nozzle", {"exit_area_ratio": 2.5, "back_pressure_ratio": back_pressure, "gamma": 1.4})
            self.assertEqual(result["profile"]["regime"], expected)

def test_internal_shock_profile_contains_physical_jump(self):
    limits = self.nozzle_limits()
    back_pressure = (limits["chokingPressureRatio"] + limits["shockAtExitPressureRatio"]) / 2
    result = calculate("cd-nozzle", {"exit_area_ratio": 2.5, "back_pressure_ratio": back_pressure, "gamma": 1.4})
    profile = result["profile"]
    shock_points = [point for point in profile["points"] if point.get("side")]
    self.assertEqual([point["side"] for point in shock_points], ["pre_shock", "post_shock"])
    self.assert_close(shock_points[0]["x"], shock_points[1]["x"])
    self.assertGreater(shock_points[0]["mach"], 1)
    self.assertLess(shock_points[1]["mach"], 1)
    self.assertGreater(shock_points[1]["pressureRatio"], shock_points[0]["pressureRatio"])
    self.assert_close(profile["exit"]["pressureRatio"], back_pressure, 2e-6)

def test_cd_nozzle_boundary_tolerance_is_stable(self):
    limits = self.nozzle_limits()
    for key, regime in (("chokingPressureRatio", "choked"), ("shockAtExitPressureRatio", "shock_at_exit"), ("designPressureRatio", "design")):
        boundary = limits[key]
        for perturbation in (-1e-10, 0, 1e-10):
            result = calculate("cd-nozzle", {"exit_area_ratio": 2.5, "back_pressure_ratio": boundary + perturbation, "gamma": 1.4})
            self.assertEqual(result["profile"]["regime"], regime)

def test_cd_nozzle_rejects_nonphysical_inputs(self):
    invalid = [
        {"exit_area_ratio": 1.0, "back_pressure_ratio": 0.5, "gamma": 1.4},
        {"exit_area_ratio": 2.0, "back_pressure_ratio": 0.0, "gamma": 1.4},
        {"exit_area_ratio": 2.0, "back_pressure_ratio": 1.1, "gamma": 1.4},
    ]
    for inputs in invalid:
        self.assertFalse(calculate("cd-nozzle", inputs)["ok"])
```

- [ ] **Step 6: Run new regime tests and verify RED**

Run:

```powershell
python -m unittest tests.test_aerodynamics.AerodynamicsTests.test_cd_nozzle_classifies_all_pressure_regimes tests.test_aerodynamics.AerodynamicsTests.test_internal_shock_profile_contains_physical_jump tests.test_aerodynamics.AerodynamicsTests.test_cd_nozzle_boundary_tolerance_is_stable tests.test_aerodynamics.AerodynamicsTests.test_cd_nozzle_rejects_nonphysical_inputs -v
```

Expected: internal shock and boundary cases fail until the full solver exists.

- [ ] **Step 7: Implement shock search and complete regime classification**

Implement `_exit_pressure_after_shock(shock_area, exit_area_ratio, gamma)` and use `common.bisect` to find the shock area whose subsonic exit pressure equals `pb/p0`. Compute downstream stagnation pressure from `p02/p01`, derive downstream `A/A*`, and sample the subsonic branch after the paired shock points. Use `math.isclose(..., rel_tol=REGIME_TOLERANCE, abs_tol=REGIME_TOLERANCE)` for the three named boundaries.

Set `shock_x` by bisecting `geometry_area(x, exit_area_ratio) - shock_area` over `[THROAT_X, 1]`. For `shock_at_exit`, return pre/post samples at `x = 1`. For overexpanded, design, and underexpanded cases, keep the internal profile isentropic and let the UI indicate exit mismatch.

- [ ] **Step 8: Run all Python tests and verify GREEN**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: every Python test passes with finite profiles.

- [ ] **Step 9: Document equations and limitations**

Extend `docs/scientific-validation.md` with a **CD nozzle operating model** section covering the area distribution, area-Mach inversion, back-pressure boundaries, normal-shock bisection, tolerance value, and the qualitative-only nature of external wave marks. Cite the existing NASA/NACA sources already used by the project rather than the reference simulator's implementation.

- [ ] **Step 10: Commit the solver**

```powershell
git add aerodynamics/cd_nozzle.py aerodynamics/__init__.py tests/test_aerodynamics.py docs/scientific-validation.md
git commit -m "feat: solve CD nozzle operating profiles"
```

---

### Task 3: Add the typed frontend contract and calculator registration

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/calculators.ts`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: Python profile JSON from Task 2.
- Produces: `NozzleRegime`, `NozzleProfilePoint`, `NozzleProfile`, and optional `CalculationResult.profile`.
- Produces: `CalculatorId` member `cd-nozzle` and a calculator definition using keys `exit_area_ratio`, `back_pressure_ratio`, and `gamma`.

- [ ] **Step 1: Add a failing registration test**

Update the engine mock with a CD nozzle response fixture and add:

```tsx
it('registers CD Nozzle with physical operating inputs', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /cd nozzle/i }))
  expect(screen.getByLabelText(/exit-to-throat area ratio/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/back-pressure ratio/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/specific heat ratio/i)).toBeInTheDocument()
})
```

Adjust the existing seven-calculator assertion to expect eight.

- [ ] **Step 2: Run the registration test and verify RED**

Run:

```powershell
pnpm test -- src/App.test.tsx
```

Expected: CD Nozzle button is absent.

- [ ] **Step 3: Define types and calculator metadata**

Add the spec's profile types to `src/lib/types.ts`, using camelCase names that exactly match the JSON returned by Python. Extend `CalculationResult`:

```ts
export interface CalculationResult {
  ok: boolean
  values?: Record<string, number>
  profile?: NozzleProfile
  warnings?: string[]
  error?: { code: string; message: string }
}
```

Add `cd-nozzle` to `CalculatorId`, the `icons` record, and `calculators` with defaults `Ae/At = 2.5`, `pb/p0 = 0.2`, `gamma = 1.4`. Label the model as a one-dimensional analytical CD nozzle.

- [ ] **Step 4: Run frontend tests and TypeScript checking**

Run:

```powershell
pnpm test -- src/App.test.tsx
pnpm lint
```

Expected: registration test and existing tests pass.

- [ ] **Step 5: Commit the frontend contract**

```powershell
git add src/lib/types.ts src/lib/calculators.ts src/App.tsx src/App.test.tsx
git commit -m "feat: register CD nozzle calculator"
```

---

### Task 4: Build the synchronized SVG nozzle visualization

**Files:**
- Create: `src/components/NozzleVisualization.tsx`
- Create: `src/components/NozzleVisualization.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `profile: NozzleProfile`.
- Produces: `<NozzleVisualization profile={profile} />`.
- Owns: SVG scales, path generation, active sample index, pointer-to-sample mapping, and keyboard sample navigation.
- Does not own: gas-dynamics equations or regime classification.

- [ ] **Step 1: Add failing solver-data rendering tests**

Create a small fixture with a repeated shock coordinate and test real rendered output:

```tsx
const profile: NozzleProfile = {
  throatX: 0.4,
  shockX: 0.72,
  regime: 'internal_shock',
  limits: { chokingPressureRatio: 0.8, shockAtExitPressureRatio: 0.4, designPressureRatio: 0.06 },
  exit: { mach: 0.5, pressureRatio: 0.55, backPressureRatio: 0.55 },
  points: [
    { x: 0, areaRatio: 2.5, mach: 0.2, pressureRatio: 0.97 },
    { x: 0.4, areaRatio: 1, mach: 1, pressureRatio: 0.528 },
    { x: 0.72, areaRatio: 1.6, mach: 1.94, pressureRatio: 0.14, side: 'pre_shock' },
    { x: 0.72, areaRatio: 1.6, mach: 0.59, pressureRatio: 0.60, side: 'post_shock' },
    { x: 1, areaRatio: 2.5, mach: 0.5, pressureRatio: 0.55 },
  ],
}

it('aligns throat and shock markers across all panels', () => {
  render(<NozzleVisualization profile={profile} />)
  expect(screen.getAllByTestId('throat-marker')).toHaveLength(3)
  expect(screen.getAllByTestId('shock-marker')).toHaveLength(3)
  expect(new Set(screen.getAllByTestId('shock-marker').map(node => node.getAttribute('x1'))).size).toBe(1)
})

it('renders the paired shock samples as a discontinuity', () => {
  render(<NozzleVisualization profile={profile} />)
  expect(screen.getByTestId('mach-profile')).toHaveAttribute('d', expect.stringContaining('L'))
  expect(screen.getByTestId('pressure-profile')).toHaveAttribute('d', expect.stringContaining('L'))
})
```

- [ ] **Step 2: Run component tests and verify RED**

Run:

```powershell
pnpm test -- src/components/NozzleVisualization.test.tsx
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement static responsive SVG panels**

Create `NozzleVisualization.tsx` with one SVG `viewBox`, shared `plotLeft`/`plotRight`, and three panel bands. Use pure helpers `xScale`, `linearScale`, and `pathFromPoints`. Geometry wall height is proportional to `sqrt(areaRatio)` because rendered half-height represents radius for a circular-equivalent section; add a component comment explaining that visual mapping.

Render technical grid lines, orange walls, centerline, flow arrow, cyan Mach and pressure paths, `M = 1`, axes, labels, regime badge, and shared throat/shock markers. Preserve repeated shock `x` points in array order so SVG paths draw vertical jumps.

- [ ] **Step 4: Run static component tests and verify GREEN**

Run the component test file. Expected: marker and discontinuity tests pass.

- [ ] **Step 5: Add failing hover, keyboard, regime, and accessibility tests**

Add:

```tsx
it('shares the selected axial sample across the readout and cursor', () => {
  render(<NozzleVisualization profile={profile} />)
  fireEvent.pointerMove(screen.getByTestId('nozzle-interaction-layer'), { clientX: 400 })
  expect(screen.getByText(/x\/l/i).parentElement).toHaveTextContent('0.720')
  expect(screen.getAllByTestId('shared-cursor')).toHaveLength(3)
})

it('supports keyboard traversal of profile samples', () => {
  render(<NozzleVisualization profile={profile} />)
  const layer = screen.getByTestId('nozzle-interaction-layer')
  layer.focus()
  fireEvent.keyDown(layer, { key: 'ArrowRight' })
  expect(screen.getByRole('status')).toHaveTextContent('x/L')
})

it('describes the regime without relying on color', () => {
  render(<NozzleVisualization profile={profile} />)
  expect(screen.getByRole('img', { name: /internal shock/i })).toBeInTheDocument()
  expect(screen.getByText(/normal shock inside the diverging section/i)).toBeInTheDocument()
})
```

Use a mocked `getBoundingClientRect()` with a fixed width in the pointer test so client coordinates map deterministically.

- [ ] **Step 6: Run interaction tests and verify RED**

Run the component test file. Expected: failures because the interaction layer and operating summary are absent.

- [ ] **Step 7: Implement synchronized interaction and external-wave indications**

Add `activeIndex` state. Map pointer `clientX` through the SVG element's bounding rectangle to normalized `x`; select the closest point, preferring `post_shock` when distances tie unless the previous active sample was `pre_shock`. Add `tabIndex={0}`, ArrowLeft/ArrowRight navigation, and a live status readout.

Render compression marks only for `overexpanded`, expansion rays only for `underexpanded`, and neither for `design`. Give these groups textual labels that include “qualitative”. Add an always-visible operating summary for every regime.

- [ ] **Step 8: Style and verify the responsive component**

Add focused `.nozzle-viz` styles to `src/styles.css`: bordered panel, technical grid, mono labels, cyan/orange/red variables, touch-safe interaction layer, and compact mobile labels below `620px`. Run:

```powershell
pnpm test -- src/components/NozzleVisualization.test.tsx
pnpm lint
```

Expected: all component tests and TypeScript checks pass.

- [ ] **Step 9: Commit the component**

```powershell
git add src/components/NozzleVisualization.tsx src/components/NozzleVisualization.test.tsx src/styles.css
git commit -m "feat: visualize synchronized nozzle profiles"
```

---

### Task 5: Integrate the nozzle result experience and verify the application

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `CalculationResult.profile` and `<NozzleVisualization>`.
- Preserves: generic `ResultPlot` for every calculator except `cd-nozzle`.

- [ ] **Step 1: Add failing application integration tests**

Make the mocked engine return the nozzle fixture only for `calculatorId === 'cd-nozzle'`, then add:

```tsx
it('shows the engineering nozzle display for a solved CD Nozzle case', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /cd nozzle/i }))
  fireEvent.click(await screen.findByRole('button', { name: /calculate/i }))
  expect(await screen.findByRole('img', { name: /internal shock/i })).toBeInTheDocument()
  expect(screen.queryByText(/relative magnitudes/i)).not.toBeInTheDocument()
})

it('keeps the generic plot when a non-nozzle result has no profile', async () => {
  render(<App />)
  await screen.findByText('Python engine ready')
  fireEvent.click(screen.getByRole('button', { name: /calculate/i }))
  expect(await screen.findByText(/relative magnitudes/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run application tests and verify RED**

Run:

```powershell
pnpm test -- src/App.test.tsx
```

Expected: nozzle result still renders the generic plot.

- [ ] **Step 3: Integrate the dedicated result component**

Import `NozzleVisualization` and replace the unconditional result plot with:

```tsx
{activeId === 'cd-nozzle' && result.profile
  ? <NozzleVisualization profile={result.profile} />
  : <ResultPlot definition={definition} values={result.values ?? {}} />}
```

Guard malformed success responses: if `activeId === 'cd-nozzle'` and `profile` is absent, render the existing error presentation with a concise “Nozzle profile unavailable” message rather than throwing. Update the sidebar model count and footer version copy without hardcoding inconsistent counts in multiple places; derive the count from `calculators.length` where practical.

- [ ] **Step 4: Run frontend and Python suites**

Run:

```powershell
python -m unittest discover -s tests -v
pnpm test
pnpm lint
```

Expected: all tests and type checking pass with no warnings or unreported failures.

- [ ] **Step 5: Update README feature description**

Change the calculator count to eight and add one sentence explaining that CD Nozzle profiles are one-dimensional analytical results with qualitative external-wave indications. Keep the safety-critical disclaimer unchanged.

- [ ] **Step 6: Build production assets**

Run:

```powershell
pnpm build
```

Expected: Python modules copy into `public/python/aerodynamics`, TypeScript compiles, and Vite finishes successfully.

- [ ] **Step 7: Perform browser visual verification**

Start the app with `pnpm dev`, open it in the available browser, and verify at desktop and approximately `390px` width:

- All three panels share throat, shock, and cursor positions.
- The internal-shock Mach drop and pressure rise are visible.
- Labels remain legible without horizontal page overflow.
- Subsonic, design, overexpanded, and underexpanded sample inputs show their correct summaries and allowable annotations.
- Keyboard arrows move the readout through samples.

Record any defect as a failing automated test before fixing it.

- [ ] **Step 8: Commit integration and documentation**

```powershell
git add src/App.tsx src/App.test.tsx README.md
git commit -m "feat: integrate CD nozzle workspace"
```

---

### Task 6: Final scientific and regression verification

**Files:**
- Modify only files required by failures discovered in this task, always after adding a reproducing test.

**Interfaces:**
- Verifies the complete public Python calculation response and rendered application behavior.

- [ ] **Step 1: Run whitespace and repository checks**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intended tracked changes, if any, are present.

- [ ] **Step 2: Run the complete verification matrix**

```powershell
python -m unittest discover -s tests -v
pnpm test
pnpm lint
pnpm build
```

Expected: all commands exit zero. Report every failure by name if the baseline contains unrelated failures; do not omit them.

- [ ] **Step 3: Inspect representative serialized profiles**

Run a short Python command that calls `calculate("cd-nozzle", ...)` for subsonic, internal-shock, design, overexpanded, and underexpanded inputs derived from returned limits. Assert all profile numbers are finite, `x` remains in `[0, 1]`, throat and shock metadata agree with point coordinates, and exit pressure equals back pressure for internally subsonic cases.

- [ ] **Step 4: Review against the specification**

Check every requirement in `docs/superpowers/specs/2026-09-23-cd-nozzle-visualization-design.md` against the implementation. Confirm there is no copied reference text or asset, no TypeScript gas-dynamics solver, and no CFD wording.

- [ ] **Step 5: Commit verification fixes if required**

If Step 2–4 exposed a defect, add its regression test, fix it, rerun the matrix, and commit only those changes:

```powershell
git add aerodynamics src tests docs README.md
git commit -m "fix: harden CD nozzle visualization"
```
