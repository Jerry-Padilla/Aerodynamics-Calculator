/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope
type Pyodide = { FS: { mkdirTree(path: string): void; writeFile(path: string, content: string): void }; runPython(code: string): unknown }
let pyodide: Pyodide | undefined

const modules = ['__init__.py', 'common.py', 'isentropic.py', 'normal_shock.py', 'oblique_shock.py', 'prandtl_meyer.py', 'fanno.py', 'rayleigh.py', 'natural_convection.py']

async function initialize() {
  if (pyodide) return
  const source = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs'
  const runtime = await import(/* @vite-ignore */ source) as { loadPyodide: (options: { indexURL: string }) => Promise<Pyodide> }
  pyodide = await runtime.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/' })
  pyodide.FS.mkdirTree('/aerodynamics')
  const base = new URL(import.meta.env.BASE_URL, self.location.origin)
  await Promise.all(modules.map(async file => {
    const response = await fetch(new URL(`python/aerodynamics/${file}`, base))
    if (!response.ok) throw new Error(`Could not load Python module ${file}.`)
    pyodide!.FS.writeFile(`/aerodynamics/${file}`, await response.text())
  }))
  pyodide.runPython("import sys; sys.path.insert(0, '/'); from aerodynamics import calculate; import json")
}

self.onmessage = async event => {
  try {
    if (event.data.type === 'initialize') {
      await initialize()
      self.postMessage({ type: 'ready' })
      return
    }
    await initialize()
    const request = event.data.request
    const calculatorId = JSON.stringify(request.calculatorId)
    const inputs = JSON.stringify(request.inputs)
    const serialized = pyodide!.runPython(`json.dumps(calculate(${calculatorId}, json.loads(${JSON.stringify(inputs)})))`) as string
    self.postMessage({ type: 'result', id: event.data.id, result: JSON.parse(serialized) })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (event.data.type === 'initialize') self.postMessage({ type: 'fatal', message })
    else self.postMessage({ type: 'result', id: event.data.id, result: { ok: false, error: { code: 'engine', message } } })
  }
}

export {}

