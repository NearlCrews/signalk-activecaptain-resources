/**
 * A collapsible data-source card for the configuration panel's accordion.
 * The header row carries an enable checkbox (or an "Always on" badge for a
 * source with no enable toggle), the source name, a one-line summary, an
 * optional live-status pill (request count plus error flag), and an expand
 * chevron; the source's own fields render as `children` only while the card
 * is expanded. The card is collapsed by default, so a panel with several
 * sources stays scannable: each source is one row until opened.
 *
 * Disclosure state lives on the panel root and is threaded down through
 * `expanded` + `onToggleExpanded`, mirroring the emitter-cannon panel.
 * Keeping the state outside the card lets it survive any future subtree
 * remount and lets the panel persist it across saves if it ever wants to.
 *
 * An always-on source (one with no enable toggle) omits `onToggleEnabled`;
 * the header shows the "Always on" badge instead of a checkbox so it cannot
 * be mistaken for a disabled toggle.
 *
 * Card body fields stay rendered whether or not the source is enabled, so a
 * user can pre-configure a source before flipping the enable toggle on. The
 * card body composes the source-specific field components; child fields use
 * the `disabled` prop on their inputs to express "this knob is inert while
 * the parent toggle is off" rather than conditionally hiding the row.
 */

import type * as React from 'react'
import { S } from '../styles.js'
import type { SourceStatus } from '../../status/status-types.js'

interface Props {
  /** Source name shown in the header, e.g. `ActiveCaptain`. */
  name: string
  /** Whether the source is enabled. */
  enabled: boolean
  /** One-line summary of the source's settings, shown collapsed. */
  summary: string
  /** Whether the card is currently expanded. */
  expanded: boolean
  /** Toggle the expanded state on a header click. */
  onToggleExpanded: () => void
  /**
   * Called when the enable checkbox is toggled. Omitted for an always-on
   * source, whose checkbox is then shown checked and disabled.
   */
  onToggleEnabled?: (enabled: boolean) => void
  /**
   * Per-source status snapshot. When present and the source is enabled,
   * the card header surfaces a compact pill with the last list-fetch
   * POI count and an error mark, so a collapsed row still tells the
   * operator what the source is doing.
   */
  status?: SourceStatus
  /** The source's configuration fields, rendered while the card is expanded. */
  children: React.ReactNode
}

/** A collapsible card for one POI data source. */
export default function DataSourceCard ({
  name,
  enabled,
  summary,
  expanded,
  onToggleExpanded,
  onToggleEnabled,
  status,
  children
}: Props): React.ReactElement {
  return (
    <div style={S.sourceCard}>
      <div style={S.sourceCardHeader}>
        {onToggleEnabled !== undefined
          ? (
            <input
              type='checkbox'
              style={S.checkbox}
              checked={enabled}
              aria-label={`Enable ${name}`}
              onChange={(e) => onToggleEnabled(e.target.checked)}
            />
            )
          : (
            // An always-on source shows a non-interactive "Always on" badge
            // rather than a disabled checkbox: a disabled checkbox is
            // visually indistinguishable from an off-and-greyed-out toggle,
            // so an operator might think the source is unavailable.
            <span style={S.alwaysOnBadge} aria-label={`${name} is always on`}>
              Always on
            </span>
            )}
        <button
          type='button'
          style={S.sourceCardToggle}
          aria-expanded={expanded}
          onClick={onToggleExpanded}
        >
          <span style={S.sourceCardName}>{name}</span>
          <span style={S.sourceCardSummary}>{summary}</span>
          {enabled && status !== undefined ? <SourceStatusPill status={status} /> : null}
          <span style={S.sourceCardChevron} aria-hidden='true'>{expanded ? '▾' : '▸'}</span>
        </button>
      </div>
      {expanded ? <div style={S.sourceCardBody}>{children}</div> : null}
    </div>
  )
}

/**
 * Render a compact status pill: the last list-fetch POI count when known,
 * or a muted "no fetch yet" placeholder, with a red error variant when the
 * most recent attempt failed (apiReachable === false).
 */
function SourceStatusPill ({ status }: { status: SourceStatus }): React.ReactElement {
  const hasError = status.apiReachable === false
  const pillStyle = hasError
    ? { ...S.sourceStatusPill, ...S.sourceStatusPillError }
    : S.sourceStatusPill
  const label = status.lastListFetch !== null
    ? `${status.lastListFetch.poiCount} POI`
    : 'idle'
  const title = hasError ? `${status.name}: last request failed` : `${status.name}: last list fetch`
  return (
    <span style={pillStyle} title={title} aria-label={title}>
      {hasError ? '!' : '✓'} {label}
    </span>
  )
}
