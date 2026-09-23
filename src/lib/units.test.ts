import { describe, expect, it } from 'vitest'
import { fromSI, toSI } from './units'

describe('unit conversions', () => {
  it('round trips temperatures, lengths, heat, and specific heat', () => {
    for (const [kind, value] of [['temperature', 300], ['length', 2.5], ['heat', 120000], ['specificHeat', 1005]] as const) {
      expect(toSI(kind, fromSI(kind, value, 'US'), 'US')).toBeCloseTo(value, 9)
    }
  })
})
