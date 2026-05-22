/**
 * The route-corridor hazard scan controls: an opt-in toggle and the corridor
 * width. The width input holds a raw-text draft while the user edits, so the
 * field can be cleared mid-edit instead of snapping back to a number on every
 * keystroke, and commits a clamped, whole number of meters. It is disabled
 * while the scan is off, because the width then has no effect.
 */

import type * as React from 'react'
import { useState } from 'react'
import { S } from '../styles.js'

/** Stable id linking the visible label to the corridor-width input. */
const WIDTH_FIELD_ID = 'ac-route-corridor-width'

/**
 * Smallest corridor width the plugin accepts. A zero width would leave the
 * scan enabled but never able to flag a point of interest, so the field floors
 * at one meter, matching the `routeCorridorWidthMeters` schema minimum.
 */
const MIN_WIDTH_METERS = 1

interface Props {
  enabled: boolean
  corridorWidthMeters: number
  onToggleEnabled: (enabled: boolean) => void
  onChangeWidth: (meters: number) => void
}

/** The route-corridor hazard scan controls shown in the configuration panel. */
export default function RouteHazardScanFields ({
  enabled,
  corridorWidthMeters,
  onToggleEnabled,
  onChangeWidth
}: Props): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string): void => {
    if (raw.trim() === '') {
      onChangeWidth(MIN_WIDTH_METERS)
      return
    }
    const parsed = Number(raw)
    onChangeWidth(Number.isFinite(parsed)
      ? Math.max(MIN_WIDTH_METERS, Math.trunc(parsed))
      : MIN_WIDTH_METERS)
  }

  return (
    <section style={S.groupsSection}>
      <fieldset style={S.group}>
        <legend style={S.groupTitle}>Route-corridor hazard scan</legend>
        <label style={S.proximityToggle}>
          <input
            type='checkbox'
            style={S.checkbox}
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
          />
          Flag hazards, bridges, and locks along the active route
        </label>
        <p style={S.hint}>
          When enabled, and the vessel has an active Course API route, the
          plugin scans the route ahead and raises a Signal K notification for
          each hazard, bridge, and lock within the corridor width of the
          route, with its along-track distance and ETA.
        </p>
        <div style={S.proximityRow}>
          <label htmlFor={WIDTH_FIELD_ID} style={S.label}>Corridor width (meters)</label>
          <input
            id={WIDTH_FIELD_ID}
            type='number'
            min={MIN_WIDTH_METERS}
            step={50}
            style={S.input}
            disabled={!enabled}
            value={draft ?? String(corridorWidthMeters)}
            onChange={(e) => {
              setDraft(e.target.value)
              commit(e.target.value)
            }}
            onBlur={() => setDraft(null)}
          />
          <p style={S.hint}>
            A point of interest within this distance either side of the route
            line is treated as on the route.
          </p>
        </div>
      </fieldset>
    </section>
  )
}
