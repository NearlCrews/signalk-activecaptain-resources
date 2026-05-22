/**
 * Parsing of the loosely typed SignalK resource-provider query into a search
 * bounding box.
 */

import { positionToBbox } from './positionUtilities.js'
import type { Bbox, Position } from './types.js'

/**
 * Normalise a query `position` value into a Position, or null if unusable.
 *
 * SignalK passes the search centre either as a `{ latitude, longitude }`
 * object or as a `[longitude, latitude]` array (the order the legacy plugin
 * relied on).
 */
export function resolvePosition (raw: unknown): Position | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    const longitude = Number(raw[0])
    const latitude = Number(raw[1])
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return { latitude, longitude }
    }
    return null
  }

  if (raw !== null && typeof raw === 'object') {
    const candidate = raw as Record<string, unknown>
    const latitude = Number(candidate.latitude)
    const longitude = Number(candidate.longitude)
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude }
    }
  }

  return null
}

/**
 * Parse an explicit `bbox` query value into a Bbox.
 *
 * The box is four numbers in GeoJSON bounding-box order (RFC 7946),
 * `[minLongitude, minLatitude, maxLongitude, maxLatitude]`, supplied either as
 * an array or as a comma-separated string (with or without surrounding
 * brackets). Returns null when the value is not four finite numbers.
 */
function resolveExplicitBbox (raw: unknown): Bbox | null {
  let parts: unknown[]
  if (typeof raw === 'string') {
    parts = raw.replace(/[[\]\s]/g, '').split(',')
  } else if (Array.isArray(raw)) {
    parts = raw
  } else {
    return null
  }

  if (parts.length !== 4) {
    return null
  }
  const [west, south, east, north] = parts.map(Number)
  if (![west, south, east, north].every(value => Number.isFinite(value))) {
    return null
  }
  return { west, south, east, north }
}

/**
 * Derive a search bounding box from a SignalK resource query.
 *
 * The `notes` resource provider receives the request query as loosely typed
 * key/value pairs. Two forms are supported: an explicit `bbox` (a four-number
 * GeoJSON bounding box), and the `position` + `distance`
 * form chart plotters send, where `position` is the search centre and
 * `distance` is the radius in metres. Returns null when the query does not
 * carry enough information to build a box.
 */
export function resolveBbox (query: Record<string, unknown>): Bbox | null {
  if (query.bbox !== undefined) {
    return resolveExplicitBbox(query.bbox)
  }

  const distance = Number(query.distance)
  if (!Number.isFinite(distance) || distance <= 0) {
    return null
  }

  const centre = resolvePosition(query.position)
  if (centre === null) {
    return null
  }

  return positionToBbox(centre, distance)
}
