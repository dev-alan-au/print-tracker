import type { AppSettings } from '@shared/types'
import type { Db } from '../db/database'

export const DEFAULT_SETTINGS: AppSettings = {
  spoolerEnabled: true,
  spoolerPollIntervalMs: 5000,
  autoStartWatching: true,
  minFileStabilityMs: 1500
}

export class SettingsService {
  constructor(private readonly db: Db) {}

  get(): AppSettings {
    const rows = this.db.all<{ key: string; value: string }>('SELECT key, value FROM settings')
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS }

    for (const row of rows) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, row.key)) continue
      try {
        merged[row.key] = JSON.parse(row.value)
      } catch {
        /* keep the default when the stored value is corrupt */
      }
    }

    return merged as unknown as AppSettings
  }

  update(patch: Partial<AppSettings>): AppSettings {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) continue
      this.db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, JSON.stringify(value)]
      )
    }
    return this.get()
  }
}
