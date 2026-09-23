export type CalculatorId = 'isentropic' | 'normal-shock' | 'oblique-shock' | 'prandtl-meyer' | 'fanno' | 'rayleigh' | 'natural-convection'
export type UnitSystem = 'SI' | 'US'

export interface CalculationRequest {
  schemaVersion: 1
  calculatorId: CalculatorId
  inputs: Record<string, number>
  unitSystem: UnitSystem
}

export interface CalculationResult {
  ok: boolean
  values?: Record<string, number>
  warnings?: string[]
  error?: { code: string; message: string }
}

export interface SavedCase extends CalculationRequest {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type AnalyticsEventName = 'calculator_opened' | 'calculation_succeeded' | 'validation_error' | 'case_saved' | 'share_created' | 'export_used'
export interface AnalyticsProperties { calculatorId?: CalculatorId; category?: string }

