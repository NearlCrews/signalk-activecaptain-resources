/*
 * MIT License
 *
 * Copyright (c) 2024 Paul Willems <paul.willems@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Position monitor and hazard scan.
 *
 * When proximity alarms are enabled, this module subscribes to the vessel's
 * `navigation.position` through the SignalK app. It throttles those updates:
 * a tick runs only when the vessel has moved a meaningful distance and at most
 * once per minute. Each tick scans for hazards by listing the points of
 * interest in a bounding box around the vessel, then hands the result to the
 * proximity alarms for evaluation. The scan does not populate the
 * point-of-interest detail cache; it only feeds the alarm check.
 *
 * The monitor is created in `start()` only when `enableProximityAlarms` is on,
 * and `stop()` fully tears it down: it unsubscribes from the position stream
 * and clears every outstanding alarm.
 */

import type { NormalizedDelta, Path } from '@signalk/server-api'
import { distanceMeters, positionToBbox } from './positionUtilities.js'
import type { ProximityAlarms } from './proximityAlarms.js'
import type { Bbox, PoiSummary, Position } from './types.js'

/** The `vessels.self` path the monitor subscribes to. */
const SELF_POSITION_PATH = 'navigation.position'

/** Default minimum distance, in metres, the vessel must move before a tick. */
const DEFAULT_MIN_MOVE_METERS = 100

/** Default minimum time, in milliseconds, between ticks. */
const DEFAULT_MIN_INTERVAL_MS = 60_000

/**
 * The minimal Bacon-stream surface the monitor consumes: subscribe to values
 * and receive an unsubscribe function. `StreamBundle.getSelfBus` returns a
 * `Bacon.Bus`, which satisfies this structurally.
 */
export interface PositionStream {
  onValue: (handler: (delta: NormalizedDelta) => void) => () => void
}

/**
 * The slice of the SignalK app the monitor needs. The real `ServerAPI`
 * satisfies this structurally, so the plugin entrypoint passes `app` directly;
 * tests pass a small stub.
 */
export interface MonitorApp {
  streambundle: {
    getSelfBus: (path: Path) => PositionStream
  }
  debug: (message: string) => void
}

/** The slice of the ActiveCaptain client the monitor needs for the hazard scan. */
export interface PoiListSource {
  listPointsOfInterest: (bbox: Bbox, poiTypes: string) => Promise<PoiSummary[]>
}

/** Dependencies and tunables for {@link createPositionMonitor}. */
export interface PositionMonitorConfig {
  /** The SignalK app, used for the position stream and debug logging. */
  app: MonitorApp
  /** The ActiveCaptain client, used to list nearby hazards. */
  client: PoiListSource
  /** The proximity alarms evaluated on every tick. */
  alarms: ProximityAlarms
  /**
   * The comma-separated ActiveCaptain `poiTypes` string for the hazard-scan
   * list request. It must include `Hazard`, otherwise the scan never returns a
   * hazard and the proximity alarms can never fire.
   */
  poiTypes: string
  /** Radius, in metres, of the bounding box scanned around the vessel. */
  scanRadiusMeters: number
  /**
   * Minimum distance, in metres, the vessel must move before a new tick runs.
   * Defaults to {@link DEFAULT_MIN_MOVE_METERS}.
   */
  minMoveMeters?: number
  /**
   * Minimum time, in milliseconds, between ticks. Defaults to
   * {@link DEFAULT_MIN_INTERVAL_MS}.
   */
  minIntervalMs?: number
  /** Clock source, injectable for tests. Defaults to `Date.now`. */
  now?: () => number
}

/** Public surface of the position monitor. */
export interface PositionMonitor {
  /**
   * Tear the monitor down: unsubscribe from the position stream and clear
   * every outstanding proximity alarm. Idempotent.
   */
  stop: () => void
}

/**
 * Narrow an unknown delta value into a `Position`, or return null when it is
 * not a usable latitude/longitude pair. A position delta can briefly carry a
 * null value (no fix), so this guards rather than trusting the shape.
 */
function toPosition (value: unknown): Position | null {
  if (value === null || typeof value !== 'object') {
    return null
  }
  const { latitude, longitude } = value as Record<string, unknown>
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return { latitude, longitude }
}

/**
 * Create a position monitor and subscribe it to `navigation.position`.
 *
 * @param config Dependencies and throttle tunables.
 * @returns A handle whose `stop()` fully tears the monitor down.
 */
export function createPositionMonitor (config: PositionMonitorConfig): PositionMonitor {
  const { app, client, alarms, poiTypes, scanRadiusMeters } = config
  const minMoveMeters = config.minMoveMeters ?? DEFAULT_MIN_MOVE_METERS
  const minIntervalMs = config.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
  const now = config.now ?? Date.now

  let stopped = false
  // True while a scan request is outstanding, so a burst of position updates
  // cannot stack overlapping list requests on top of one another.
  let tickInFlight = false
  // The most recent position fix, updated on every delta even while a scan is
  // in flight. The scan evaluates hazards against this, not the position it
  // started from, so a multi-second request does not check stale coordinates.
  let latestPosition: Position | undefined
  let lastTickPosition: Position | undefined
  let lastTickTime = 0

  /**
   * Decide whether a position warrants a tick: always on the first fix, then
   * only when both the time and the distance thresholds have been met.
   */
  function shouldTick (position: Position): boolean {
    if (lastTickPosition === undefined) {
      return true
    }
    if (now() - lastTickTime < minIntervalMs) {
      return false
    }
    return distanceMeters(lastTickPosition, position) >= minMoveMeters
  }

  async function runTick (tickPosition: Position): Promise<void> {
    tickInFlight = true
    // Commit the throttle before the await: a tick that started consumes the
    // window whether it succeeds or fails, so a flaky connection cannot drive
    // a tight retry loop.
    lastTickPosition = tickPosition
    lastTickTime = now()
    try {
      const bbox = positionToBbox(tickPosition, scanRadiusMeters)
      const pois = await client.listPointsOfInterest(bbox, poiTypes)
      // A response that lands after stop() must not drive an evaluation.
      if (stopped) {
        return
      }
      // Evaluate against the newest fix, not the one the scan started from:
      // the rate-limited request can take seconds. The scanned bounding box is
      // far larger than that drift, so the newer position is still inside it.
      alarms.evaluate(latestPosition ?? tickPosition, pois)
    } catch (error) {
      // A failed scan is non-fatal and expected while offline: the pull-through
      // path still works, this tick simply has no fresh data. Logged at debug
      // level so an offline passage does not spam the log.
      app.debug(`Position monitor hazard scan failed: ${String(error)}`)
    } finally {
      tickInFlight = false
      // A position that arrived while the scan was in flight was deferred;
      // act on it now that the slot is free.
      maybeTick()
    }
  }

  /** Start a tick for the latest position when the throttle and state allow. */
  function maybeTick (): void {
    if (stopped || tickInFlight || latestPosition === undefined) {
      return
    }
    if (!shouldTick(latestPosition)) {
      return
    }
    const tickPosition = latestPosition
    app.debug(`Position monitor tick at ${tickPosition.latitude}, ${tickPosition.longitude}`)
    // runTick handles its own errors internally and never rejects; the catch
    // is a defensive guard so an unexpected throw cannot become an unhandled
    // rejection from this fire-and-forget call.
    runTick(tickPosition).catch((error: unknown) => {
      app.debug(`Position monitor tick failed unexpectedly: ${String(error)}`)
    })
  }

  function onPosition (delta: NormalizedDelta): void {
    if (stopped) {
      return
    }
    const position = toPosition(delta.value)
    if (position === null) {
      return
    }
    latestPosition = position
    maybeTick()
  }

  const unsubscribe = app.streambundle
    .getSelfBus(SELF_POSITION_PATH as Path)
    .onValue(onPosition)
  app.debug('Position monitor started; subscribed to navigation.position')

  return {
    stop: () => {
      if (stopped) {
        return
      }
      stopped = true
      unsubscribe()
      alarms.clearAll()
      app.debug('Position monitor stopped')
    }
  }
}
