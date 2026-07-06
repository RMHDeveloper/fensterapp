const KEY = 'fenster_app_settings'

export interface AppSettings {
  productionRate: number    // ₹ per sq.ft, default 100
  installationRate: number  // ₹ per sq.ft, default 25
}

const DEFAULTS: AppSettings = { productionRate: 100, installationRate: 25 }

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAppSettings(settings: Partial<AppSettings>): void {
  localStorage.setItem(KEY, JSON.stringify({ ...getAppSettings(), ...settings }))
}
