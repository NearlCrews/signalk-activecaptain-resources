/**
 * The route-corridor hazard scan controls: an opt-in toggle and the corridor
 * width. Built on the shared `AlarmFieldset` layout; only the labels, ids, and
 * the width minimum are specific to this alarm.
 */

import type * as React from 'react'
import AlarmFieldset from './AlarmFieldset.js'

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
  return (
    <AlarmFieldset
      title='Route-corridor hazard scan'
      numberFieldId='ac-route-corridor-width'
      toggleLabel='Flag hazards, bridges, and locks along the active route'
      toggleHint='When enabled, and the vessel has an active Course API route, the plugin scans the route ahead and raises a Signal K notification for each hazard, bridge, and lock within the corridor width of the route, with its along-track distance and ETA.'
      enabled={enabled}
      onToggleEnabled={onToggleEnabled}
      numberLabel='Corridor width (meters)'
      numberHint='A point of interest within this distance either side of the route line is treated as on the route.'
      numberMin={MIN_WIDTH_METERS}
      numberStep={50}
      numberValue={corridorWidthMeters}
      onChangeNumber={onChangeWidth}
    />
  )
}
