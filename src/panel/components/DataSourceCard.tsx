/**
 * A collapsible data-source card for the configuration panel's accordion.
 * The header row carries an enable checkbox (or an "Always on" badge for a
 * source with no enable toggle), the source name, a one-line summary, an
 * optional live-status pill, and an expand chevron. The source's own fields
 * render as `children` always (gated by CSS visibility, not by conditional
 * mount) so an in-progress draft inside a NumberField survives a collapse
 * and re-expand of the card.
 *
 * Disclosure state lives on the panel root and is threaded down through
 * `expanded` + `onToggleExpanded(cardId)`. Keeping the state outside the
 * card lets it survive any future subtree remount, lets the panel persist
 * it across saves if it ever wants to, and lets the panel iterate cards
 * with a stable map of slug to expanded-flag.
 *
 * The card surfaces "Disabled" inline in the summary when the enable
 * toggle is off, so a collapsed disabled row reads as off at a glance and
 * not just as a configured-but-unchecked source. An always-on source (one
 * with no enable toggle) omits `onToggleEnabled`; the header shows an
 * "Always on" badge instead of a checkbox so it cannot be mistaken for a
 * disabled toggle.
 *
 * The optional `status` prop drives a compact pill rendered AS A SIBLING
 * of the disclosure button, not nested inside it: a touch user tapping
 * the pill must not toggle the card, and a screen reader walking the
 * header must not absorb the pill's status text into the button's
 * accessible name.
 */

import type * as React from 'react'
import { S } from '../styles.js'
import { pillContent, pillVariant } from '../source-status-pill.js'
import type { SourceStatus } from '../../status/status-types.js'

interface Props {
  /**
   * Stable id used as the disclosure-state key, e.g. `'activecaptain'`.
   * Mirrors the source's PoiSource.id so the same string keys the panel's
   * expandedCards map AND looks up the source's StatusSnapshot entry.
   */
  cardId: string
  /** Source name shown in the header, e.g. `ActiveCaptain`. */
  name: string
  /** Whether the source is enabled. */
  enabled: boolean
  /** One-line summary of the source's settings, shown collapsed. */
  summary: string
  /** Whether the card is currently expanded. */
  expanded: boolean
  /** Toggle the expanded state on a header click; receives the cardId. */
  onToggleExpanded: (cardId: string) => void
  /**
   * Called when the enable checkbox is toggled. Omitted for an always-on
   * source, whose checkbox is then shown checked and disabled.
   */
  onToggleEnabled?: (enabled: boolean) => void
  /**
   * Per-source status snapshot. When present, the card header surfaces a
   * compact pill reporting the last list-fetch outcome (idle / ok /
   * error). The pill renders regardless of enabled state because a
   * recently-disabled source can still carry meaningful last-fetch state
   * for an operator triaging the panel.
   */
  status?: SourceStatus
  /** The source's configuration fields. */
  children: React.ReactNode
}

/** A collapsible card for one POI data source. */
export default function DataSourceCard ({
  cardId,
  name,
  enabled,
  summary,
  expanded,
  onToggleExpanded,
  onToggleEnabled,
  status,
  children
}: Props): React.ReactElement {
  // Prefix the summary with "Disabled" when the enable toggle is off, so
  // a collapsed disabled card never reads as if it were live (the small
  // unchecked checkbox alone is too subtle a signal).
  const summaryText = enabled ? summary : `Disabled. ${summary}`
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
          aria-controls={bodyId(cardId)}
          onClick={() => onToggleExpanded(cardId)}
        >
          <span style={S.sourceCardName}>{name}</span>
          <span style={S.sourceCardSummary}>{summaryText}</span>
          <span style={S.sourceCardChevron} aria-hidden='true'>{expanded ? '▾' : '▸'}</span>
        </button>
        {status !== undefined ? <SourceStatusPill status={status} /> : null}
      </div>
      {/* Body always mounts; visibility flips via display so the per-field
          draft state survives a collapse-and-expand round trip. */}
      <div
        id={bodyId(cardId)}
        style={expanded ? S.sourceCardBody : S.collapsedBody}
        aria-hidden={!expanded}
      >
        {children}
      </div>
    </div>
  )
}

/** Build a stable id for the card's body region (used by aria-controls). */
function bodyId (cardId: string): string {
  return `ac-source-card-body-${cardId}`
}

/**
 * Render a compact status pill with three states: idle (no list-fetch
 * outcome recorded yet), ok (last fetch returned data), and error (last
 * attempt failed). Distinct glyphs and tooltip wording prevent the
 * "idle" and "ok" states from collapsing into the same green check.
 *
 * The pill carries a `title` attribute for sighted hover. It does NOT
 * carry an aria-label: the pill lives outside the disclosure button so
 * the visible glyph plus count is exposed to assistive tech as its own
 * accessible name, with the title delivering the longer "last fetch N
 * minutes ago" context.
 */
function SourceStatusPill ({ status }: { status: SourceStatus }): React.ReactElement {
  const variant = pillVariant(status)
  const pillStyle = variant === 'error'
    ? PILL_ERROR
    : variant === 'idle'
      ? PILL_IDLE
      : S.sourceStatusPill
  const { glyph, label, title } = pillContent(status, variant)
  // role="status" makes the pill a polite live region so screen readers
  // announce state changes when they arrive (e.g. the first fetch
  // completing). aria-label carries the longer "last fetch N min ago"
  // context that a sighted user reads from the title tooltip; the visible
  // glyph + label is decorative once the longer label is set, so the
  // span text is hidden from the AT.
  return (
    <span style={pillStyle} role='status' aria-label={title} title={title}>
      <span aria-hidden='true'>{glyph} {label}</span>
    </span>
  )
}

// pillVariant + pillContent are in `../source-status-pill.ts` so the
// unit tests can import them without bringing in JSX.

// Pre-computed style objects for the non-default pill variants, so React
// sees a stable identity across renders rather than a fresh spread per
// render. The base S.sourceStatusPill is used directly for the ok case.
const PILL_ERROR = { ...S.sourceStatusPill, ...S.sourceStatusPillError }
const PILL_IDLE = { ...S.sourceStatusPill, ...S.sourceStatusPillIdle }
