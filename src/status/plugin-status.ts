/**
 * Request-outcome recorder for the plugin.
 *
 * The plugin calls these recording methods around its ActiveCaptain client
 * calls; the status endpoint reads a StatusSnapshot back out. The recorder
 * holds only observed outcomes, so producing a snapshot generates no extra
 * Garmin API traffic: `apiReachable` is derived passively from whether the
 * most recent request succeeded or failed.
 */

import type { LastListFetch, StatusError, StatusSnapshot } from './status-types.js'

/** Upper bound on retained errors. Older entries are dropped past this count. */
const MAX_RECENT_ERRORS = 5

/** Records request outcomes and produces a StatusSnapshot on demand. */
export interface PluginStatus {
  /** Record a successful list fetch that returned `poiCount` points of interest. */
  recordListFetch: (poiCount: number) => void
  /** Record a successful point-of-interest detail resolution. */
  recordDetailSuccess: () => void
  /** Record a failed request, keeping the message in the recent-errors list. */
  recordError: (message: string) => void
  /**
   * Produce a point-in-time snapshot. The caller supplies `cachedPoiCount`
   * because the cached entry count is owned by the cache, not the recorder.
   */
  snapshot: (cachedPoiCount: number) => StatusSnapshot
}

/**
 * Create a PluginStatus recorder. `startedAt` is captured here, so a fresh
 * recorder is created on each plugin start to reflect the current run.
 */
export function createPluginStatus (): PluginStatus {
  const startedAt = new Date().toISOString()
  let apiReachable: boolean | null = null
  let lastListFetch: LastListFetch | null = null
  const recentErrors: StatusError[] = []

  return {
    recordListFetch: (poiCount: number): void => {
      apiReachable = true
      lastListFetch = { at: new Date().toISOString(), poiCount }
    },

    recordDetailSuccess: (): void => {
      apiReachable = true
    },

    recordError: (message: string): void => {
      apiReachable = false
      recentErrors.unshift({ at: new Date().toISOString(), message })
      if (recentErrors.length > MAX_RECENT_ERRORS) {
        recentErrors.length = MAX_RECENT_ERRORS
      }
    },

    snapshot: (cachedPoiCount: number): StatusSnapshot => ({
      apiReachable,
      lastListFetch,
      cachedPoiCount,
      recentErrors: recentErrors.slice(),
      startedAt
    })
  }
}
