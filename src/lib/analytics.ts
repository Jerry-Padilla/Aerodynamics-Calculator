import posthog from 'posthog-js'
import type { AnalyticsEventName, AnalyticsProperties } from './types'

const CONSENT_KEY = 'aero-analytics-consent'

export class Analytics {
  private consent = false
  constructor(private readonly capture: (name: string, properties: AnalyticsProperties) => void) {}
  setConsent(consent: boolean) { this.consent = consent }
  track(name: AnalyticsEventName, properties: AnalyticsProperties = {}) {
    if (!this.consent) return
    const safe: AnalyticsProperties = {}
    if (properties.calculatorId) safe.calculatorId = properties.calculatorId
    if (properties.category) safe.category = properties.category
    this.capture(name, safe)
  }
}

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
if (key) posthog.init(key, { api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com', autocapture: false, capture_pageview: false, capture_pageleave: false, disable_session_recording: true, persistence: 'memory' })

export const analytics = new Analytics((name, properties) => { if (key) posthog.capture(name, properties) })
export function analyticsConsent(): boolean { return localStorage.getItem(CONSENT_KEY) === 'granted' }
export function setAnalyticsConsent(consent: boolean): void {
  localStorage.setItem(CONSENT_KEY, consent ? 'granted' : 'denied')
  analytics.setConsent(consent)
  if (!consent && key) posthog.reset()
}
analytics.setConsent(typeof localStorage !== 'undefined' && analyticsConsent())

