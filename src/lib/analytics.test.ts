import { describe, expect, it, vi } from 'vitest'
import { Analytics } from './analytics'

describe('analytics privacy boundary', () => {
  it('does not emit before consent and strips unapproved properties', () => {
    const capture = vi.fn()
    const analytics = new Analytics(capture)
    analytics.track('calculation_succeeded', { calculatorId: 'fanno', input: 42, caseName: 'secret' } as never)
    expect(capture).not.toHaveBeenCalled()
    analytics.setConsent(true)
    analytics.track('calculation_succeeded', { calculatorId: 'fanno' })
    expect(capture).toHaveBeenCalledWith('calculation_succeeded', { calculatorId: 'fanno' })
  })
})
