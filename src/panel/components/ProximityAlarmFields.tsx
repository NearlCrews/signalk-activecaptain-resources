/**
 * The proximity hazard alarm controls: an opt-in toggle and the alarm radius.
 * The radius input holds a raw-text draft while the user edits, so the field
 * can be cleared mid-edit instead of snapping back to a number on every
 * keystroke, and commits a clamped, whole number of metres. It is disabled
 * while alarms are off, because the radius then has no effect.
 */

import type * as React from 'react'
import { useState } from 'react'
import { S } from '../styles.js'

/** Stable id linking the visible label to the radius input. */
const RADIUS_FIELD_ID = 'ac-proximity-alarm-radius'

/**
 * Smallest alarm radius the plugin accepts. A zero radius would leave the
 * alarm enabled but never able to fire, so the field floors at one metre,
 * matching the `proximityAlarmRadiusMeters` schema minimum.
 */
const MIN_RADIUS_METERS = 1

interface Props {
  enabled: boolean
  radiusMeters: number
  onToggleEnabled: (enabled: boolean) => void
  onChangeRadius: (meters: number) => void
}

/** The proximity hazard alarm controls shown in the configuration panel. */
export default function ProximityAlarmFields ({
  enabled,
  radiusMeters,
  onToggleEnabled,
  onChangeRadius
}: Props): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string): void => {
    if (raw.trim() === '') {
      onChangeRadius(MIN_RADIUS_METERS)
      return
    }
    const parsed = Number(raw)
    onChangeRadius(Number.isFinite(parsed)
      ? Math.max(MIN_RADIUS_METERS, Math.trunc(parsed))
      : MIN_RADIUS_METERS)
  }

  return (
    <section style={S.groupsSection}>
      <fieldset style={S.group}>
        <legend style={S.groupTitle}>Proximity hazard alarms</legend>
        <label style={S.proximityToggle}>
          <input
            type='checkbox'
            style={S.checkbox}
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
          />
          Emit an alarm when the vessel nears a hazard
        </label>
        <p style={S.hint}>
          When enabled, the plugin subscribes to the vessel position, scans for
          nearby hazards, and raises a Signal K notification for each hazard
          within the alarm radius.
        </p>
        <div style={S.proximityRow}>
          <label htmlFor={RADIUS_FIELD_ID} style={S.label}>Alarm radius (metres)</label>
          <input
            id={RADIUS_FIELD_ID}
            type='number'
            min={MIN_RADIUS_METERS}
            step={50}
            style={S.input}
            disabled={!enabled}
            value={draft ?? String(radiusMeters)}
            onChange={(e) => {
              setDraft(e.target.value)
              commit(e.target.value)
            }}
            onBlur={() => setDraft(null)}
          />
          <p style={S.hint}>
            A hazard closer than this distance to the vessel raises a proximity
            alarm.
          </p>
        </div>
      </fieldset>
    </section>
  )
}
