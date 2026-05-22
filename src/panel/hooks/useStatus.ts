/**
 * React hook that polls the plugin's admin-gated status endpoint. It runs
 * inside the admin's authenticated session, so the gate is transparent. Polling
 * pauses while the document is hidden and resumes immediately when it becomes
 * visible again, so a backgrounded admin tab makes no needless requests.
 */

import { useEffect, useRef, useState } from 'react'
import { PLUGIN_ID } from '../../shared/plugin-id.js'
import type { StatusSnapshot } from '../../statusTypes.js'

/** The admin-gated status endpoint the plugin exposes through registerWithRouter. */
const STATUS_URL = `/plugins/${PLUGIN_ID}/api/status`

/** How often, in milliseconds, to poll the status endpoint while visible. */
const POLL_INTERVAL_MS = 5000

/**
 * Per-request timeout. Kept below the poll interval so a hung request clears
 * before the next tick rather than letting requests pile up.
 */
const REQUEST_TIMEOUT_MS = 4000

/** The status surface the panel consumes. */
export interface UseStatusResult {
  /** The most recent status snapshot, or null until the first poll succeeds. */
  status: StatusSnapshot | null
  /** A non-fatal message describing the last failed poll, or null. */
  error: string | null
}

/** Poll the plugin status endpoint and expose the latest snapshot. */
export function useStatus (): UseStatusResult {
  const [status, setStatus] = useState<StatusSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canceled = useRef(false)
  const inFlight = useRef(false)

  useEffect(() => {
    canceled.current = false
    // Aborted on unmount so an outstanding request does not run to its
    // timeout against a component that is already gone.
    const unmountController = new AbortController()

    // poll never rejects: it catches its own failures and surfaces them
    // through setError, so callers can leave its promise unhandled.
    async function poll (): Promise<void> {
      // Skip if a previous poll is still running, so a slow endpoint cannot
      // stack overlapping requests whose responses then arrive out of order.
      if (inFlight.current) {
        return
      }
      inFlight.current = true
      try {
        const response = await fetch(STATUS_URL, {
          credentials: 'same-origin',
          signal: AbortSignal.any([
            unmountController.signal,
            AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          ])
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const body = await response.json() as StatusSnapshot
        if (!canceled.current) {
          setStatus(body)
          setError(null)
        }
      } catch (e) {
        if (!canceled.current) {
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        inFlight.current = false
      }
    }

    poll()
    const intervalId = setInterval(() => {
      if (!document.hidden) poll()
    }, POLL_INTERVAL_MS)

    // A poll skipped while hidden would otherwise leave stale data on screen
    // until the next interval; refresh as soon as the tab is shown again.
    const onVisibilityChange = (): void => {
      if (!document.hidden) poll()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      canceled.current = true
      unmountController.abort()
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return { status, error }
}
