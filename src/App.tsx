import { useEffect, useMemo, useRef, useState } from 'react'
import { analytics, analyticsConsent, setAnalyticsConsent } from './lib/analytics'
import { calculatorById, calculators, defaultInputs, type CalculatorDefinition } from './lib/calculators'
import { engine } from './lib/engine'
import { decodeSharePayload, encodeSharePayload } from './lib/share'
import { clearCases, deleteCase, duplicateCase, exportCases, importCases, listCases, renameCase, saveCase } from './lib/storage'
import type { CalculationResult, CalculatorId, SavedCase, UnitSystem } from './lib/types'
import { fromSI, toSI, unitLabel } from './lib/units'

const icons: Record<CalculatorId, string> = { 'isentropic': '↗', 'normal-shock': '╫', 'oblique-shock': '◢', 'prandtl-meyer': ')))', 'fanno': '⇥', 'rayleigh': '⌁', 'natural-convection': '♨' }

function formatValue(value: number): string {
  const magnitude = Math.abs(value)
  if ((magnitude > 0 && magnitude < 0.001) || magnitude >= 100000) return value.toExponential(4)
  return value.toFixed(5)
}

function initialFromUrl() {
  const payload = new URLSearchParams(location.search).get('case')
  if (!payload) return undefined
  try { return decodeSharePayload(payload) } catch { return undefined }
}

export default function App() {
  const shared = useMemo(initialFromUrl, [])
  const [activeId, setActiveId] = useState<CalculatorId>(shared?.calculatorId ?? 'isentropic')
  const [inputs, setInputs] = useState<Record<string, number>>(shared?.inputs ?? defaultInputs(calculatorById[activeId]))
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(shared?.unitSystem ?? 'SI')
  const [result, setResult] = useState<CalculationResult>()
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [cases, setCases] = useState<SavedCase[]>(listCases)
  const [caseOpen, setCaseOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [consent, setConsent] = useState(analyticsConsent)
  const [toast, setToast] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const definition = calculatorById[activeId]

  useEffect(() => { engine.initialize().then(() => setEngineState('ready')).catch(() => setEngineState('error')) }, [])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer) }, [toast])

  const selectCalculator = (id: CalculatorId) => {
    setActiveId(id); setInputs(defaultInputs(calculatorById[id])); setResult(undefined)
    analytics.track('calculator_opened', { calculatorId: id })
  }

  const switchUnits = (next: UnitSystem) => {
    if (next === unitSystem) return
    const converted = { ...inputs }
    definition.fields.forEach(field => { converted[field.key] = fromSI(field.kind, toSI(field.kind, inputs[field.key], unitSystem), next) })
    setInputs(converted); setUnitSystem(next); setResult(undefined)
  }

  const calculate = async () => {
    setBusy(true); setResult(undefined)
    const normalized = Object.fromEntries(definition.fields.map(field => [field.key, toSI(field.kind, inputs[field.key], unitSystem)]))
    try {
      const response = await engine.calculate({ schemaVersion: 1, calculatorId: activeId, inputs: normalized, unitSystem })
      setResult(response)
      analytics.track(response.ok ? 'calculation_succeeded' : 'validation_error', response.ok ? { calculatorId: activeId } : { calculatorId: activeId, category: response.error?.code })
    } catch {
      setResult({ ok: false, error: { code: 'engine', message: 'The calculation engine became unavailable. Retry initialization and calculate again.' } })
    } finally { setBusy(false) }
  }

  const reset = () => { setInputs(defaultInputs(definition)); setResult(undefined) }
  const save = () => {
    const name = window.prompt('Name this calculation case:', `${definition.shortName} case`)
    if (!name) return
    saveCase(name, activeId, inputs, unitSystem); setCases(listCases()); setToast('Case saved locally'); analytics.track('case_saved', { calculatorId: activeId })
  }
  const share = async () => {
    const payload = encodeSharePayload(activeId, inputs, unitSystem)
    const url = new URL(location.href); url.search = ''; url.searchParams.set('case', payload)
    await navigator.clipboard.writeText(url.toString()); setToast('Share link copied'); analytics.track('share_created', { calculatorId: activeId })
  }
  const openCase = (item: SavedCase) => { setActiveId(item.calculatorId); setInputs(item.inputs); setUnitSystem(item.unitSystem); setResult(undefined); setCaseOpen(false) }
  const download = () => {
    const blob = new Blob([exportCases()], { type: 'application/json' }); const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'aerodynamics-cases.json'; anchor.click(); URL.revokeObjectURL(url)
    analytics.track('export_used')
  }
  const upload = async (file?: File) => {
    if (!file) return
    try { importCases(await file.text()); setCases(listCases()); setToast('Cases imported') } catch (error) { setToast(error instanceof Error ? error.message : 'Import failed') }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="Aerodynamics Calculator home">
        <span className="brand-mark"><i /><i /><i /></span><span>AERO<span>CALC</span></span>
      </a>
      <div className="top-actions">
        <span className={`engine-pill ${engineState}`}><b />{engineState === 'ready' ? 'Python engine ready' : engineState === 'loading' ? 'Loading Python…' : 'Engine offline'}</span>
        <div className="unit-switch" aria-label="Unit system"><button className={unitSystem === 'SI' ? 'active' : ''} onClick={() => switchUnits('SI')}>SI</button><button className={unitSystem === 'US' ? 'active' : ''} onClick={() => switchUnits('US')}>US</button></div>
        <button className="text-button" onClick={() => setCaseOpen(true)}>Cases <span>{cases.length}</span></button>
        <button className="icon-button" aria-label="Privacy" onClick={() => setPrivacyOpen(true)}>ⓘ</button>
      </div>
    </header>

    <aside className="sidebar">
      <p className="nav-label">Flow library</p>
      <nav>{calculators.map(item => <button key={item.id} className={activeId === item.id ? 'active' : ''} onClick={() => selectCalculator(item.id)}><span className="nav-icon">{icons[item.id]}</span><span><strong>{item.shortName}</strong><small>{item.eyebrow}</small></span><em>›</em></button>)}</nav>
      <div className="sidebar-note"><span>07</span><p><strong>models online</strong>All calculations run locally in your browser.</p></div>
    </aside>

    <main>
      <section className="hero">
        <div><p className="kicker">Engineering workspace <span>•</span> Browser-native Python</p><h1>Aerodynamics<br /><span>Calculator</span></h1><p className="hero-copy">Compressible-flow and convection tools with transparent assumptions, solver-aware validation, and no server-side data collection.</p><p className="credit">Designed & engineered by <strong>Chase + Gerard</strong></p></div>
        <FlowGraphic id={activeId} />
      </section>

      <section className="workspace">
        <div className="workspace-head"><div><p className="section-number">{String(calculators.findIndex(item => item.id === activeId) + 1).padStart(2, '0')} / 07</p><h2>{definition.name}</h2><p>{definition.description}</p></div><div className="status-tag"><b />ACTIVE MODEL</div></div>
        <div className="work-grid">
          <section className="input-panel" aria-label="Calculation inputs">
            <div className="panel-title"><span>INPUT CONDITIONS</span><button onClick={reset}>Reset defaults</button></div>
            <div className="field-grid">{definition.fields.map(field => <label key={field.key}><span><b>{field.label}</b><abbr title={field.help}>{field.symbol}</abbr></span><div className="input-wrap"><input type="number" value={inputs[field.key]} min={field.min} max={field.max} step={field.step ?? 'any'} onChange={event => setInputs({ ...inputs, [field.key]: Number(event.target.value) })} /><em>{field.fixedUnit ?? unitLabel(field.kind, unitSystem)}</em></div><small>{field.help}</small></label>)}</div>
            {engineState === 'error' && <div className="inline-error">Python could not initialize. <button onClick={() => { setEngineState('loading'); engine.retry().then(() => setEngineState('ready')).catch(() => setEngineState('error')) }}>Retry engine</button></div>}
            <div className="action-row"><button className="primary" disabled={busy || engineState !== 'ready'} onClick={calculate}>{busy ? 'Solving…' : 'Calculate'} <span>→</span></button><button onClick={save}>Save case</button><button onClick={share}>Share link</button></div>
          </section>

          <section className="results-panel" aria-live="polite">
            <div className="panel-title"><span>SOLUTION</span>{result?.ok && <em>Converged</em>}</div>
            {!result && <div className="empty-results"><FlowLines /><h3>Ready to solve</h3><p>Enter the upstream conditions and run the model. Results stay on this device.</p></div>}
            {result && !result.ok && <div className="error-state"><span>!</span><h3>{result.error?.code.replaceAll('_', ' ')}</h3><p>{result.error?.message}</p></div>}
            {result?.ok && <><div className="result-grid">{Object.entries(result.values ?? {}).filter(([key]) => definition.resultLabels[key]).map(([key, value]) => <article key={key}><span>{definition.resultLabels[key]}</span><strong>{formatValue(value)}</strong><small>{key.endsWith('_deg') ? 'degrees' : key.endsWith('_k') ? 'kelvin' : 'dimensionless'}</small></article>)}</div><ResultPlot definition={definition} values={result.values ?? {}} /></>}
          </section>
        </div>
        <details className="theory"><summary><span>THEORY & ASSUMPTIONS</span><em>+</em></summary><div><code>{definition.equation}</code><ul>{definition.assumptions.map(item => <li key={item}>{item}</li>)}</ul></div></details>
      </section>
    </main>

    <footer><span>AERODYNAMICS CALCULATOR · V1.0</span><p>Numerical tools are educational engineering aids. Verify results for safety-critical work.</p><button onClick={() => setPrivacyOpen(true)}>Privacy & local data</button></footer>
    {caseOpen && <CasesDrawer cases={cases} onClose={() => setCaseOpen(false)} onOpen={openCase} onRefresh={() => setCases(listCases())} onExport={download} onImport={() => fileInput.current?.click()} />}
    {privacyOpen && <Modal title="Privacy & local data" onClose={() => setPrivacyOpen(false)}><p>This app never sends calculation inputs, results, case names, or share-link payloads. Cases are stored only in this browser.</p><label className="consent"><input type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); setAnalyticsConsent(event.target.checked) }} /><span><strong>Share anonymous usage events</strong><small>Calculator names and action categories only. No form values, session recordings, or identity.</small></span></label><button className="danger-button" onClick={() => { clearCases(); setCases([]); setToast('Local cases cleared') }}>Clear all local cases</button></Modal>}
    <input ref={fileInput} type="file" accept="application/json" hidden onChange={event => upload(event.target.files?.[0])} />
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </div>
}

function FlowGraphic({ id }: { id: CalculatorId }) {
  return <div className="flow-graphic" aria-hidden="true"><div className="speed-readout"><span>MODEL</span><strong>{id === 'natural-convection' ? 'Ra' : 'M'}</strong><small>{calculatorById[id].shortName}</small></div><svg viewBox="0 0 520 250"><defs><linearGradient id="wake"><stop stopColor="#36d7ee" stopOpacity="0"/><stop offset=".5" stopColor="#36d7ee"/><stop offset="1" stopColor="#36d7ee" stopOpacity="0"/></linearGradient></defs>{[45,72,99,126,153,180,207].map((y, index) => <path key={y} d={`M12 ${y} C 155 ${y - 12}, 205 ${y + (index-3)*3}, 500 ${y}`} />)}<path className="body" d="M150 126 L280 87 L397 126 L280 165 Z"/><circle cx="150" cy="126" r="4" /></svg><div className="axis"><span>UPSTREAM</span><i /><span>SOLUTION DOMAIN</span></div></div>
}

function FlowLines() { return <svg className="flow-lines" viewBox="0 0 220 100" aria-hidden="true">{[20,40,60,80].map(y => <path key={y} d={`M5 ${y} C70 ${y-8},130 ${y+8},215 ${y}`} />)}<path className="shape" d="M80 50 L125 28 L162 50 L125 72 Z" /></svg> }

function ResultPlot({ definition, values }: { definition: CalculatorDefinition; values: Record<string, number> }) {
  const entries = Object.entries(values).filter(([key, value]) => definition.resultLabels[key] && Number.isFinite(value)).slice(0, 5)
  const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1)
  return <div className="mini-plot"><div className="plot-head"><span>RELATIVE MAGNITUDES</span><small>normalized visualization</small></div>{entries.map(([key, value]) => <div className="bar" key={key}><span>{definition.resultLabels[key]}</span><i style={{ width: `${Math.max(3, Math.abs(value) / max * 100)}%` }} /><em>{formatValue(value)}</em></div>)}</div>
}

function CasesDrawer({ cases, onClose, onOpen, onRefresh, onExport, onImport }: { cases: SavedCase[]; onClose(): void; onOpen(item: SavedCase): void; onRefresh(): void; onExport(): void; onImport(): void }) {
  return <div className="overlay" onMouseDown={onClose}><aside className="drawer" onMouseDown={event => event.stopPropagation()}><div className="drawer-head"><div><p>LOCAL WORKSPACE</p><h2>Saved cases</h2></div><button aria-label="Close cases" onClick={onClose}>×</button></div><div className="case-tools"><button onClick={onImport}>Import JSON</button><button onClick={onExport} disabled={!cases.length}>Export all</button></div><div className="case-list">{cases.length === 0 ? <div className="no-cases"><span>◇</span><h3>No saved cases</h3><p>Save any calculation to revisit it here.</p></div> : cases.map(item => <article key={item.id}><button className="case-main" onClick={() => onOpen(item)}><span>{icons[item.calculatorId]}</span><div><strong>{item.name}</strong><small>{calculatorById[item.calculatorId].shortName} · {item.unitSystem}</small></div></button><div><button aria-label={`Rename ${item.name}`} onClick={() => { const name = prompt('Rename case:', item.name); if (name) { renameCase(item.id, name); onRefresh() } }}>✎</button><button aria-label={`Duplicate ${item.name}`} onClick={() => { duplicateCase(item.id); onRefresh() }}>⧉</button><button aria-label={`Delete ${item.name}`} onClick={() => { deleteCase(item.id); onRefresh() }}>×</button></div></article>)}</div></aside></div>
}

function Modal({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  return <div className="overlay modal-overlay" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}><div className="drawer-head"><h2>{title}</h2><button aria-label="Close privacy" onClick={onClose}>×</button></div>{children}</section></div>
}
