/**
 * Route-hazard output.
 *
 * A position-driven output: it scans the active route ahead and raises a
 * SignalK route notification for each Hazard, Bridge, or Lock in the route
 * corridor. It contributes a route-corridor fetch box to the shared position
 * monitor and runs the corridor scan on every tick. Owns the
 * `enableRouteHazardScan` and `routeCorridorWidthMeters` config properties.
 *
 * The active route is read once per tick, in `buildFetchBox`, and reused in
 * `evaluate`, so a course delta arriving mid-tick cannot make the fetch box
 * and the scan disagree.
 */

import { createCourseReader } from './course-reader.js'
import { createRouteHazardAlarms } from './route-hazard-alarms.js'
import { CORRIDOR_POI_TYPES, routeLegPoints, scanRouteCorridor } from './route-corridor.js'
import type { OutputContext, OutputHandle, OutputModule, PositionScanContributor } from '../output.js'
import { distanceMeters, positionToBbox, unionBbox } from '../../geo/position-utilities.js'
import type { Bbox, CorridorPoi, Position, RoutePolyline } from '../../shared/types.js'

/** Default route-corridor half-width, in meters; mirrors the schema default. */
const DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS = 500

/** Meters in a nautical mile. */
const METERS_PER_NAUTICAL_MILE = 1852

/**
 * How far ahead along the route, in meters, the fetch box is widened. Beyond
 * this cap the ActiveCaptain bounding-box endpoint clusters results, so the
 * look-ahead is a sliding window: a point past the cap is picked up on a
 * later tick.
 */
const ROUTE_LOOK_AHEAD_METERS = 10 * METERS_PER_NAUTICAL_MILE

/** The route-hazard config fragment. */
const CONFIG_SCHEMA: Record<string, unknown> = {
  enableRouteHazardScan: {
    type: 'boolean',
    title: 'Scan the active route ahead for hazards, bridges, and locks (uses the Course API)',
    default: false
  },
  routeCorridorWidthMeters: {
    type: 'number',
    title: 'Route corridor half-width in meters (a hazard is flagged within this distance either side of the route)',
    default: DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS,
    minimum: 1
  }
}

/**
 * Resolve the corridor half-width from raw config, applying the default.
 * Rejects non-finite values (NaN, Infinity) so a hand-edited config file
 * cannot propagate NaN through routeCorridorBbox into the outbound list URL.
 */
function resolveCorridorWidth (raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_ROUTE_CORRIDOR_WIDTH_METERS
  }
  return raw
}

/**
 * Build a bounding box enclosing the route ahead, out to the look-ahead cap,
 * each route point expanded by the corridor half-width. Returns `null` when
 * the route carries no usable points. Lifted from the legacy position monitor.
 */
function routeCorridorBbox (route: RoutePolyline, corridorWidthMeters: number): Bbox | null {
  const points = routeLegPoints(route)

  let box: Bbox | undefined
  let traveledMeters = 0
  let previous: Position | undefined
  for (const point of points) {
    if (previous !== undefined) {
      traveledMeters += distanceMeters(previous, point)
    }
    const pointBox = positionToBbox(point, corridorWidthMeters)
    box = box === undefined ? pointBox : unionBbox(box, pointBox)
    previous = point
    if (traveledMeters >= ROUTE_LOOK_AHEAD_METERS) {
      break
    }
  }
  return box ?? null
}

/** The route-hazard output module. */
export const routeHazardOutput: OutputModule = {
  id: 'route-hazard',
  name: 'Route-corridor hazard scan',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config) => config.enableRouteHazardScan === true,
  start: (context: OutputContext): OutputHandle => {
    const corridorWidthMeters = resolveCorridorWidth(context.config.routeCorridorWidthMeters)
    // The alarms are built before the course reader: createCourseReader opens
    // two Course API delta subscriptions, so if alarm construction were to
    // throw after that, those subscriptions would be orphaned with no stop()
    // handle. Constructing the alarms first keeps any throw subscription-free.
    const alarms = createRouteHazardAlarms(context.app)
    const courseReader = createCourseReader({ app: context.app })

    // The route read in buildFetchBox, reused in evaluate within the same tick.
    let tickRoute: RoutePolyline | null = null

    const positionScan: PositionScanContributor = {
      poiTypes: CORRIDOR_POI_TYPES,
      buildFetchBox: () => {
        tickRoute = courseReader.getRouteAhead()
        return tickRoute === null
          ? null
          : routeCorridorBbox(tickRoute, corridorWidthMeters)
      },
      evaluate: (vesselPosition, pois) => {
        let corridorPois: CorridorPoi[] = []
        if (tickRoute !== null) {
          const vesselState = courseReader.getVesselState()
          corridorPois = scanRouteCorridor({
            // Scan from the fresh fix the monitor passes, not the position
            // getRouteAhead froze in buildFetchBox before the list request:
            // on a moving vessel the two differ by the distance traveled
            // during that multi-second request.
            route: { ...tickRoute, vesselPosition },
            pois,
            corridorWidthMeters,
            speedOverGround: vesselState.speedOverGround
          }).filter((poi) => poi.alongTrackDistanceMeters <= ROUTE_LOOK_AHEAD_METERS)
        }
        alarms.evaluate(corridorPois)
      }
    }
    return {
      stop: () => {
        alarms.clearAll()
        courseReader.stop()
      },
      positionScan
    }
  }
}
