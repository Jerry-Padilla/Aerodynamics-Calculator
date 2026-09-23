import type { CalculatorId, SavedCase, UnitSystem } from './types'

const KEY = 'aero-cases-v1'
const CALCULATORS = new Set<CalculatorId>(['isentropic', 'normal-shock', 'oblique-shock', 'prandtl-meyer', 'fanno', 'rayleigh', 'natural-convection'])

function validCase(value: unknown): value is SavedCase {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.schemaVersion === 1 && typeof item.id === 'string' && typeof item.name === 'string' &&
    CALCULATORS.has(item.calculatorId as CalculatorId) && (item.unitSystem === 'SI' || item.unitSystem === 'US') &&
    !!item.inputs && typeof item.inputs === 'object' && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string'
}

function write(cases: SavedCase[]) {
  localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, cases }))
}

export function listCases(): SavedCase[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: number; cases?: unknown[] }
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.cases) || !parsed.cases.every(validCase)) return []
    return parsed.cases
  } catch {
    return []
  }
}

export function saveCase(name: string, calculatorId: CalculatorId, inputs: Record<string, number>, unitSystem: UnitSystem): SavedCase {
  const now = new Date().toISOString()
  const saved: SavedCase = { schemaVersion: 1, id: crypto.randomUUID(), name: name.trim() || 'Untitled case', calculatorId, inputs, unitSystem, createdAt: now, updatedAt: now }
  write([saved, ...listCases()])
  return saved
}

export function renameCase(id: string, name: string): void {
  write(listCases().map(item => item.id === id ? { ...item, name: name.trim() || item.name, updatedAt: new Date().toISOString() } : item))
}

export function duplicateCase(id: string): SavedCase {
  const source = listCases().find(item => item.id === id)
  if (!source) throw new Error('Saved case not found.')
  return saveCase(`${source.name} copy`, source.calculatorId, source.inputs, source.unitSystem)
}

export function deleteCase(id: string): void { write(listCases().filter(item => item.id !== id)) }
export function clearCases(): void { localStorage.removeItem(KEY) }
export function exportCases(): string { return JSON.stringify({ schemaVersion: 1, cases: listCases() }, null, 2) }

export function importCases(raw: string): SavedCase[] {
  let parsed: { schemaVersion?: number; cases?: unknown[] }
  try { parsed = JSON.parse(raw) } catch { throw new Error('The selected file is not valid JSON.') }
  if (parsed.schemaVersion !== 1) throw new Error('Unsupported case file version.')
  if (!Array.isArray(parsed.cases) || !parsed.cases.every(validCase)) throw new Error('The case file contains invalid records.')
  write(parsed.cases)
  return parsed.cases
}

