# Aerodynamics Calculator

A portfolio-quality engineering workspace built by Chase and Gerard. It provides seven browser-based calculators for isentropic flow, normal shocks, oblique shocks, Prandtl–Meyer expansion fans, Fanno flow, Rayleigh flow, and natural-convection Rayleigh/Grashof numbers.

The equations run as Python inside a Pyodide Web Worker. There is no calculation server, account system, or cloud database: saved cases remain in browser storage and shared cases are encoded in the URL.

## Numerical status

The original [`calculations.m`](calculations.m) file is preserved as historical provenance, **not** treated as authoritative. Equations, conventions, corrections, and benchmark coverage are documented in [`docs/scientific-validation.md`](docs/scientific-validation.md).

## Local development

Requirements: Node.js 22+, pnpm 10+, and Python 3.11+.

```bash
pnpm install
python -m unittest discover -s tests -v
pnpm test
pnpm dev
```

The first browser load downloads the pinned Pyodide runtime from jsDelivr. Python files are copied into `public/python/` during development and production builds.

## Verification

```bash
python -m unittest discover -s tests -v
pnpm test
pnpm lint
pnpm build
```

CI runs the same checks for pull requests and pushes to `main`.

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Keep the detected framework as **Vite**.
3. Use `pnpm build` as the build command and `dist` as the output directory; these are declared in `vercel.json`.
4. Optionally add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`. Without them, analytics remains completely disabled.
5. Deploy. Future commits receive preview deployments and `main` can deploy automatically.

Vercel hosts static output only. Aerodynamic inputs and results continue to execute locally in the visitor's browser.

## Privacy

- Cases are stored in browser `localStorage` and can be exported or cleared.
- Analytics requires explicit consent.
- Autocapture, identity, session recording, input values, results, case names, and share payloads are excluded.
- The app works with analytics disabled.

## Important limitation

This software is an educational engineering aid. Verify results independently before using them in safety-critical design or analysis.
