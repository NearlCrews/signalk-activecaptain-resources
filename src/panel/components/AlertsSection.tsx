/**
 * The Alerts zone of the configuration panel: the proximity hazard alarm and
 * the route-corridor hazard scan, grouped under one heading. These are
 * source-agnostic: they alarm on hazards from every enabled data source.
 */

import type * as React from 'react'
import type { Dispatch } from 'react'
import type { ConfigAction } from '../config-reducer.js'
import {
  DEFAULT_PROXIMITY_ALARM_RADIUS_METERS,
  DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS
} from '../normalize-config.js'
import { S } from '../styles.js'
import type { PluginConfig } from '../../shared/types.js'
import ProximityAlarmFields from './ProximityAlarmFields.js'
import RouteHazardScanFields from './RouteHazardScanFields.js'

interface Props {
  state: PluginConfig
  dispatch: Dispatch<ConfigAction>
}

/** The Alerts section shown in the configuration panel. */
export default function AlertsSection ({ state, dispatch }: Props): React.ReactElement {
  return (
    <section>
      <h2 style={S.sectionHeading}>Alerts</h2>
      <ProximityAlarmFields
        enabled={state.enableProximityAlarms === true}
        radiusMeters={state.proximityAlarmRadiusMeters ?? DEFAULT_PROXIMITY_ALARM_RADIUS_METERS}
        onToggleEnabled={(enabled) => dispatch({ type: 'setProximityAlarmsEnabled', enabled })}
        onChangeRadius={(meters) => dispatch({ type: 'setProximityAlarmRadius', meters })}
      />
      <RouteHazardScanFields
        enabled={state.enableRouteHazardScan === true}
        corridorWidthMeters={state.routeCorridorWidthMeters ?? DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS}
        onToggleEnabled={(enabled) => dispatch({ type: 'setRouteHazardScanEnabled', enabled })}
        onChangeWidth={(meters) => dispatch({ type: 'setRouteCorridorWidth', meters })}
      />
    </section>
  )
}
