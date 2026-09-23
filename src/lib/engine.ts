import type { CalculationRequest, CalculationResult } from './types'

type Pending = { resolve: (value: CalculationResult) => void; reject: (reason: Error) => void }

class CalculationEngine {
  private worker?: Worker
  private ready?: Promise<void>
  private pending = new Map<string, Pending>()

  initialize(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      this.worker = new Worker(new URL('../workers/aero.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (event: MessageEvent) => {
        if (event.data.type === 'ready') return resolve()
        if (event.data.type === 'fatal') return reject(new Error(event.data.message))
        const pending = this.pending.get(event.data.id)
        if (pending) {
          this.pending.delete(event.data.id)
          pending.resolve(event.data.result)
        }
      }
      this.worker.onerror = () => reject(new Error('The Python calculation engine could not be loaded.'))
      this.worker.postMessage({ type: 'initialize' })
    })
    return this.ready
  }

  async calculate(request: CalculationRequest): Promise<CalculationResult> {
    await this.initialize()
    const id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker!.postMessage({ type: 'calculate', id, request })
    })
  }

  retry() { this.worker?.terminate(); this.worker = undefined; this.ready = undefined; this.pending.clear(); return this.initialize() }
}

export const engine = new CalculationEngine()

