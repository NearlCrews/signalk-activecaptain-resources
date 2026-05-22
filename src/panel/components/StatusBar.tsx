/**
 * Live status bar: one reachability row per enabled POI source (name, a
 * reachability dot, and the last successful list fetch), the cached POI count,
 * and any recent errors. Driven entirely by the StatusSnapshot polled from the
 * plugin.
 */

import type * as React from 'react'
import type { SourceStatus, StatusSnapshot } from '../../status/status-types.js'
import { relativeTime } from '../relative-time.js'
import { S } from '../styles.js'

/** Map the tri-state apiReachable flag to a status dot style and label. */
function apiState (reachable: boolean | null): { dot: React.CSSProperties, label: string } {
  if (reachable === true) return { dot: S.dotOk, label: 'reachable' }
  if (reachable === false) return { dot: S.dotError, label: 'unreachable' }
  return { dot: S.dotOff, label: 'not yet contacted' }
}

/** One compact reachability row for a single POI source. */
function SourceRow ({ source }: { source: SourceStatus }): React.ReactElement {
  const api = apiState(source.apiReachable)
  const fetched = source.lastListFetch === null
    ? 'no fetch yet'
    : `${relativeTime(source.lastListFetch.at)} (${source.lastListFetch.poiCount} POIs)`
  return (
    <span style={S.statusApi}>
      <span style={{ ...S.dot, ...api.dot }} aria-hidden='true' />
      <span style={S.statValue}>{source.name}</span>
      <span style={S.statLabel}>{`${api.label}, ${fetched}`}</span>
    </span>
  )
}

interface Props {
  status: StatusSnapshot | null
}

/** The status bar shown at the top of the configuration panel. */
export default function StatusBar ({ status }: Props): React.ReactElement {
  if (status === null) {
    return (
      <div style={S.statusBar} role='status'>
        <span style={{ ...S.dot, ...S.dotOff }} aria-hidden='true' />
        <span>Loading status...</span>
      </div>
    )
  }

  const { sources, recentErrors } = status

  return (
    <div style={S.statusBar} role='status'>
      {sources.length === 0
        ? <span style={S.statLabel}>No POI source is enabled</span>
        : sources.map((source) => <SourceRow key={source.source} source={source} />)}
      <span>
        <span style={S.statLabel}>Cached POIs</span>
        <span style={S.statValue}>{status.cachedPoiCount}</span>
      </span>
      {recentErrors.length > 0
        ? (
          <ul style={S.statusErrors}>
            {recentErrors.map((err, index) => (
              <li key={`${err.at}-${index}`} style={S.statusErrorItem}>
                <span style={S.statusErrorTime}>{relativeTime(err.at)}</span>
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
          )
        : null}
    </div>
  )
}
