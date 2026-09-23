import type { CalculationRequest, CalculatorId, UnitSystem } from './types'

const IDS = new Set(['isentropic', 'normal-shock', 'oblique-shock', 'prandtl-meyer', 'fanno', 'rayleigh', 'natural-convection'])

export function encodeSharePayload(calculatorId: CalculatorId, inputs: Record<string, number>, unitSystem: UnitSystem): string {
  const json = JSON.stringify({ schemaVersion: 1, calculatorId, inputs, unitSystem })
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function decodeSharePayload(encoded: string): CalculationRequest {
  if (encoded.length > 4096) throw new Error('Share payload is too large.')
  try {
    const normalized = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(normalized)
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    const item = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    if (item.schemaVersion !== 1) throw new Error('Unsupported share version.')
    if (!IDS.has(String(item.calculatorId)) || (item.unitSystem !== 'SI' && item.unitSystem !== 'US') || !item.inputs || typeof item.inputs !== 'object') throw new Error('Invalid share payload.')
    const inputs = item.inputs as Record<string, unknown>
    if (!Object.values(inputs).every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error('Invalid share inputs.')
    return item as unknown as CalculationRequest
  } catch (error) {
    if (error instanceof Error && /version|large|invalid share/.test(error.message.toLowerCase())) throw error
    throw new Error('Invalid share payload.')
  }
}

