import type { PrintTrackerApi } from '@shared/types'

declare global {
  interface Window {
    api: PrintTrackerApi
  }
}

export {}
