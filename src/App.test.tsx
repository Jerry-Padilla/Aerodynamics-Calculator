import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./lib/engine', () => ({
  engine: {
    initialize: vi.fn().mockResolvedValue(undefined),
    calculate: vi.fn().mockResolvedValue({ ok: true, values: { t0_t: 1.8, p0_p: 7.824 } }),
  },
}))

describe('calculator workspace', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('exposes all seven calculators and produces results', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /aerodynamics calculator/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /isentropic|normal shock|oblique shock|prandtl|fanno|rayleigh flow|natural convection/i })).toHaveLength(7)
    await screen.findByText('Python engine ready')
    fireEvent.click(screen.getByRole('button', { name: /calculate/i }))
    expect((await screen.findAllByText('T₀ / T')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('1.80000').length).toBeGreaterThan(0)
  })

  it('opens privacy controls without requiring consent', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /privacy/i })[0])
    expect(screen.getByText(/never sends calculation inputs/i)).toBeInTheDocument()
  })

  it('links each engineer by full name to their LinkedIn profile', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: 'Chase Santaga' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/csantaga/',
    )
    expect(screen.getByRole('link', { name: 'Gerardo R. Padilla Jr.' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/jerrypad/',
    )
  })
})
