/**
 * The proximity hazard alarm controls: an opt-in toggle and the alarm radius.
 * Built on the shared `AlarmFieldset` layout; only the labels, ids, and the
 * radius minimum are specific to this alarm.
 */

import type * as React from 'react'
import AlarmFieldset from './AlarmFieldset.js'

/**
 * Smallest alarm radius the plugin accepts. A zero radius would leave the
 * alarm enabled but never able to fire, so the field floors at one meter,
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
  return (
    <AlarmFieldset
      title='Proximity hazard alarms'
      numberFieldId='ac-proximity-alarm-radius'
      toggleLabel='Emit an alarm when the vessel nears a hazard'
      toggleHint='When enabled, the plugin subscribes to the vessel position, scans for nearby hazards, and raises a Signal K notification for each hazard within the alarm radius.'
      enabled={enabled}
      onToggleEnabled={onToggleEnabled}
      numberLabel='Alarm radius (meters)'
      numberHint='A hazard closer than this distance to the vessel raises a proximity alarm.'
      numberMin={MIN_RADIUS_METERS}
      numberStep={50}
      numberValue={radiusMeters}
      onChangeNumber={onChangeRadius}
    />
  )
}
