/**
 * Proximity-alarm output.
 *
 * A position-driven output: it raises a SignalK hazard notification when the
 * vessel comes within the configured radius of a Hazard point of interest. It
 * contributes a vessel-surroundings fetch box to the shared position monitor
 * and evaluates the proximity alarms on every tick. Owns the
 * `enableProximityAlarms` and `proximityAlarmRadiusMeters` config properties.
 */

import { createProximityAlarms } from './proximity-alarms.js'
import type { OutputContext, OutputHandle, OutputModule, PositionScanContributor } from '../output.js'
import { positionToBbox } from '../../geo/position-utilities.js'

/** Default proximity-alarm radius, in meters; mirrors the schema default. */
const DEFAULT_PROXIMITY_ALARM_RADIUS_METERS = 500

/** Lower bound on the hazard-scan radius, so the alarm check always has data. */
const MIN_SCAN_RADIUS_METERS = 2000

/** POI type the proximity alarms act on. */
const PROXIMITY_POI_TYPES = ['Hazard'] as const

/** The proximity-alarm config fragment. */
const CONFIG_SCHEMA: Record<string, unknown> = {
  enableProximityAlarms: {
    type: 'boolean',
    title: 'Emit a notification when the vessel nears a hazard (subscribes to the vessel position)',
    default: false
  },
  proximityAlarmRadiusMeters: {
    type: 'number',
    title: 'Proximity alarm radius in meters',
    default: DEFAULT_PROXIMITY_ALARM_RADIUS_METERS,
    minimum: 1
  }
}

/** Resolve the alarm radius from raw config, applying the default. */
function resolveRadius (raw: unknown): number {
  return typeof raw === 'number' && raw > 0 ? raw : DEFAULT_PROXIMITY_ALARM_RADIUS_METERS
}

/** The proximity-alarm output module. */
export const proximityAlarmOutput: OutputModule = {
  id: 'proximity-alarm',
  name: 'Proximity hazard alarms',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config) => config.enableProximityAlarms === true,
  start: (context: OutputContext): OutputHandle => {
    const radiusMeters = resolveRadius(context.config.proximityAlarmRadiusMeters)
    // The scan box is wider than the alarm radius so a hazard is fetched well
    // before it crosses the radius. This mirrors the legacy monitor sizing.
    const scanRadiusMeters = Math.max(radiusMeters * 3, MIN_SCAN_RADIUS_METERS)
    const alarms = createProximityAlarms(context.app, radiusMeters)

    const positionScan: PositionScanContributor = {
      poiTypes: PROXIMITY_POI_TYPES,
      buildFetchBox: (tickPosition) => positionToBbox(tickPosition, scanRadiusMeters),
      evaluate: (vesselPosition, pois) => { alarms.evaluate(vesselPosition, pois) }
    }
    return {
      stop: () => { alarms.clearAll() },
      positionScan
    }
  }
}
