/**
 * Bridge air-draft output.
 *
 * A position-driven output: it raises a SignalK alarm when the vessel comes
 * within the configured radius of a bridge whose vertical clearance is at or
 * below the vessel air draft plus a safety margin. It contributes a
 * vessel-surroundings fetch box to the shared position monitor and evaluates
 * the bridge clearance alarms on every tick. Owns the
 * `enableBridgeAirDraftCheck`, `vesselAirDraftMeters`, and
 * `bridgeClearanceMarginMeters` config properties.
 *
 * The "near the vessel" radius is shared with the proximity hazard alarm: this
 * output reads `proximityAlarmRadiusMeters` rather than adding a fourth config
 * field, falling back to the same 500 m default when it is unset.
 */

import { createBridgeClearanceAlarms, BRIDGE_POI_TYPES } from './bridge-clearance-alarms.js'
import { createBridgeClearanceResolver } from './bridge-clearance-resolver.js'
import {
  clampClearanceMargin,
  readVesselAirDraft,
  enableBridgeAirDraftSchema,
  vesselAirDraftSchema,
  clearanceMarginSchema
} from '../../shared/bridge-clearance.js'
import { positiveFiniteNumber } from '../../shared/numbers.js'
import { positionToBbox } from '../../geo/position-utilities.js'
import type { OutputContext, OutputHandle, OutputModule, PositionScanContributor } from '../output.js'

/**
 * Default vessel-proximity alarm radius, in meters. Mirrors the proximity-alarm
 * output's default so the two outputs share one "near the vessel" radius when
 * `proximityAlarmRadiusMeters` is unset.
 */
const DEFAULT_BRIDGE_ALARM_RADIUS_METERS = 500

/** Lower bound on the bridge-scan radius, so the clearance check always has data. */
const MIN_SCAN_RADIUS_METERS = 2000

/** The bridge air-draft config fragment, built from the shared schema builders. */
const CONFIG_SCHEMA: Record<string, unknown> = {
  enableBridgeAirDraftCheck: enableBridgeAirDraftSchema(
    'Warn when an approaching bridge is at or below the vessel air draft (subscribes to the vessel position)'
  ),
  vesselAirDraftMeters: vesselAirDraftSchema(
    'Vessel air draft in meters (0 = use the SignalK design.airHeight)'
  ),
  bridgeClearanceMarginMeters: clearanceMarginSchema(
    'Bridge clearance safety margin in meters (allowance for tide, datum, and loading)'
  )
}

/** The bridge air-draft output module. */
export const bridgeAirDraftOutput: OutputModule = {
  id: 'bridge-air-draft',
  name: 'Bridge air-draft check',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config) => config.enableBridgeAirDraftCheck === true,
  start: (context: OutputContext): OutputHandle => {
    const { app, config, pois } = context
    const marginMeters = clampClearanceMargin(config.bridgeClearanceMarginMeters)
    const fallbackAirDraftMeters = config.vesselAirDraftMeters
    const radiusMeters = positiveFiniteNumber(config.proximityAlarmRadiusMeters) ?? DEFAULT_BRIDGE_ALARM_RADIUS_METERS
    // The scan box is wider than the alarm radius so a bridge (and its
    // ActiveCaptain clearance) is fetched well before it crosses the radius.
    const scanRadiusMeters = Math.max(radiusMeters * 3, MIN_SCAN_RADIUS_METERS)

    const resolver = createBridgeClearanceResolver({
      getDetails: (id) => pois.getDetails(id),
      debug: (message) => { app.debug(message) }
    })
    const getAirDraft = (): number | null => readVesselAirDraft(app, fallbackAirDraftMeters)
    const alarms = createBridgeClearanceAlarms(app, { resolver, radiusMeters, marginMeters, getAirDraft })

    const positionScan: PositionScanContributor = {
      poiTypes: BRIDGE_POI_TYPES,
      buildFetchBox: (tickPosition) => positionToBbox(tickPosition, scanRadiusMeters),
      evaluate: (vesselPosition, pois) => { alarms.evaluate(vesselPosition, pois) }
    }
    return {
      stop: () => { alarms.clearAll() },
      positionScan
    }
  }
}
