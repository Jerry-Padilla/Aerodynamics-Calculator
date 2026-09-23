import { describe, expect, it } from 'vitest'
import { decodeSharePayload, encodeSharePayload } from './share'

describe('share payloads', () => {
  it('round trips without a case name', () => {
    const encoded = encodeSharePayload('fanno', { mach: 0.5, length_m: 5 }, 'SI')
    expect(decodeSharePayload(encoded)).toEqual({ schemaVersion: 1, calculatorId: 'fanno', inputs: { mach: 0.5, length_m: 5 }, unitSystem: 'SI' })
    expect(atob(encoded)).not.toContain('name')
  })

  it('rejects invalid, oversized, and future payloads', () => {
    expect(() => decodeSharePayload('%%%')).toThrow()
    expect(() => decodeSharePayload(btoa(JSON.stringify({ schemaVersion: 2 })))).toThrow(/version/i)
    expect(() => decodeSharePayload('a'.repeat(5000))).toThrow(/large/i)
  })
})
