import { beforeEach, describe, expect, it } from 'vitest'
import { clearCases, deleteCase, duplicateCase, importCases, listCases, saveCase } from './storage'

describe('case storage', () => {
  beforeEach(() => localStorage.clear())

  it('saves, duplicates, and deletes versioned cases', () => {
    const saved = saveCase('Cruise point', 'isentropic', { mach: 2, gamma: 1.4 }, 'SI')
    expect(listCases()).toHaveLength(1)
    expect(saved.schemaVersion).toBe(1)
    expect(duplicateCase(saved.id).name).toBe('Cruise point copy')
    deleteCase(saved.id)
    expect(listCases()).toHaveLength(1)
    clearCases()
    expect(listCases()).toEqual([])
  })

  it('rejects unsupported or malformed imports', () => {
    expect(() => importCases('{"schemaVersion":2,"cases":[]}')).toThrow(/version/i)
    expect(() => importCases('{"schemaVersion":1,"cases":[{"id":"bad"}]}')).toThrow(/invalid/i)
  })
})
