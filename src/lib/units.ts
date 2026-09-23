import type { UnitSystem } from './types'

export type UnitKind = 'temperature' | 'length' | 'heat' | 'specificHeat' | 'none'

export function fromSI(kind: UnitKind, value: number, system: UnitSystem): number {
  if (system === 'SI' || kind === 'none') return value
  if (kind === 'temperature') return (value - 273.15) * 9 / 5 + 32
  if (kind === 'length') return value / 0.3048
  if (kind === 'heat') return value / 2326
  return value / 4186.8
}

export function toSI(kind: UnitKind, value: number, system: UnitSystem): number {
  if (system === 'SI' || kind === 'none') return value
  if (kind === 'temperature') return (value - 32) * 5 / 9 + 273.15
  if (kind === 'length') return value * 0.3048
  if (kind === 'heat') return value * 2326
  return value * 4186.8
}

export function unitLabel(kind: UnitKind, system: UnitSystem): string {
  if (kind === 'none') return '—'
  if (kind === 'temperature') return system === 'SI' ? 'K' : '°F'
  if (kind === 'length') return system === 'SI' ? 'm' : 'ft'
  if (kind === 'heat') return system === 'SI' ? 'J/kg' : 'Btu/lbm'
  return system === 'SI' ? 'J/(kg·K)' : 'Btu/(lbm·°F)'
}

