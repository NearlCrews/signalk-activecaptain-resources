/**
 * A collapsible data-source card for the configuration panel's accordion. The
 * header row carries an enable checkbox (or an "Always on" badge for a source
 * with no enable toggle), the source name, a one-line summary, and an expand
 * chevron; the source's own fields render as `children` only while the card
 * is expanded. The card is collapsed by default, so a panel with several
 * sources stays scannable: each source is one row until opened.
 *
 * An always-on source (one with no enable toggle) omits `onToggleEnabled`; the
 * header shows the "Always on" badge instead of a checkbox so it cannot be
 * mistaken for a disabled toggle.
 */

import type * as React from 'react'
import { useState } from 'react'
import { S } from '../styles.js'

interface Props {
  /** Source name shown in the header, e.g. `ActiveCaptain`. */
  name: string
  /** Whether the source is enabled. */
  enabled: boolean
  /** One-line summary of the source's settings, shown collapsed when enabled. */
  summary: string
  /**
   * Called when the enable checkbox is toggled. Omitted for an always-on
   * source, whose checkbox is then shown checked and disabled.
   */
  onToggleEnabled?: (enabled: boolean) => void
  /** The source's configuration fields, rendered while the card is expanded. */
  children: React.ReactNode
}

/** A collapsible card for one POI data source. */
export default function DataSourceCard ({
  name,
  enabled,
  summary,
  onToggleEnabled,
  children
}: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

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
          onClick={() => setExpanded((open) => !open)}
        >
          <span style={S.sourceCardName}>{name}</span>
          <span style={S.sourceCardSummary}>{enabled ? summary : 'Disabled'}</span>
          <span style={S.sourceCardChevron} aria-hidden='true'>{expanded ? '▾' : '▸'}</span>
        </button>
      </div>
      {expanded ? <div style={S.sourceCardBody}>{children}</div> : null}
    </div>
  )
}
