/**
 * Status snapshot shared between the plugin and its configuration panel.
 *
 * The plugin produces a StatusSnapshot from observed request outcomes; the
 * panel polls it through the admin-gated status endpoint. Keeping the type in
 * its own module lets both the Node build and the panel build import it
 * without pulling in unrelated code.
 */

/** A single recorded error, with the time it occurred. */
export interface StatusError {
  /** ISO-8601 timestamp of when the error was recorded. */
  at: string
  /** Human-readable error message. */
  message: string
}

/** The most recent successful list fetch from the ActiveCaptain API. */
export interface LastListFetch {
  /** ISO-8601 timestamp of the fetch. */
  at: string
  /** Number of points of interest the fetch returned. */
  poiCount: number
}

/** A point-in-time view of the plugin's health, served to the config panel. */
export interface StatusSnapshot {
  /**
   * Whether the last ActiveCaptain request succeeded. Null until the plugin
   * has made its first request. Derived passively, with no extra API traffic.
   */
  apiReachable: boolean | null
  /** The most recent successful list fetch, or null if none has happened. */
  lastListFetch: LastListFetch | null
  /** Number of point-of-interest detail entries currently cached. */
  cachedPoiCount: number
  /** The most recent errors, newest first, capped at a small fixed count. */
  recentErrors: StatusError[]
  /** ISO-8601 timestamp of when the plugin most recently started. */
  startedAt: string
}
