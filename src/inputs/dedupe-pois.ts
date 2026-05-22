/**
 * Per-source POI dedupe against the ActiveCaptain base layer.
 *
 * With more than one source enabled, the same physical marina, hazard, or lock
 * can appear as separate markers a few meters apart. ActiveCaptain is the fixed
 * "base" layer. A non-base POI of the same `PoiType` within a small radius of a
 * base POI is treated as the same feature: it is dropped, and the base POI
 * survives, recording every contributing source as a corroboration signal.
 *
 * Absence of corroboration is NOT a negative signal, since source coverage is
 * uneven, so it is surfaced only as confidence-up: a base POI with no merged
 * duplicate simply lists its own source.
 */

import { distanceMeters } from '../geo/position-utilities.js'
import type { PoiSummary } from '../shared/types.js'

/** The fixed base source. Non-base POIs dedupe against ActiveCaptain POIs. */
export const BASE_SOURCE_ID = 'activecaptain'

/** Default merge radius, in meters, when a caller does not specify one. */
export const DEFAULT_DEDUPE_RADIUS_METERS = 50

/** Meters per degree of latitude, used to project positions for the grid. */
const METERS_PER_DEGREE = 111320

/** Per-source detail tracked for a surviving base POI as duplicates merge in. */
interface Corroboration {
  /** Contributing source slugs, base first, in merge order. */
  slugs: string[]
  /** Distinct attribution credit strings, base first, in merge order. */
  attributions: string[]
}

/**
 * Merge non-base POIs that coincide with a base ActiveCaptain POI.
 *
 * For each base POI (`source === BASE_SOURCE_ID`), any POI of the same
 * `PoiType` within `radiusMeters` whose `source` is in `dedupeSources` is
 * dropped as a duplicate; the base POI is the survivor. The surviving base
 * POI's `sources` lists the base slug plus every merged source, and its
 * `attribution` credits each one. A dedupe-enabled POI with no co-located base
 * POI passes through unmerged with `sources` set to its own source. A POI
 * whose source is not in `dedupeSources` is never merged or dropped.
 *
 * The pass buckets POIs into a grid of `radiusMeters`-sided cells, so it runs
 * linearly in the POI count rather than quadratically.
 */
export function dedupeAgainstBase (
  pois: PoiSummary[],
  dedupeSources: ReadonlySet<string>,
  radiusMeters: number = DEFAULT_DEDUPE_RADIUS_METERS
): PoiSummary[] {
  if (pois.length === 0) {
    return pois
  }

  const basePois = pois.filter((poi) => poi.source === BASE_SOURCE_ID)
  // With no base layer there is nothing to dedupe against: every POI passes
  // through, a dedupe-enabled one carrying its own source as its sole source.
  if (basePois.length === 0) {
    return pois.map((poi) =>
      dedupeSources.has(poi.source) ? { ...poi, sources: [poi.source] } : poi)
  }

  // Project longitude with a shared reference latitude so the grid is a
  // consistent metric: two points within radiusMeters of each other land at
  // most one cell apart on each axis, so a 3x3 neighbor scan is exhaustive.
  const meanLatRad =
    (pois.reduce((sum, poi) => sum + poi.position.latitude, 0) / pois.length) * Math.PI / 180
  const lonScale = METERS_PER_DEGREE * Math.cos(meanLatRad)
  const cellKey = (poi: PoiSummary): string => {
    const x = Math.floor((poi.position.longitude * lonScale) / radiusMeters)
    const y = Math.floor((poi.position.latitude * METERS_PER_DEGREE) / radiusMeters)
    return `${x},${y}`
  }

  // Bucket the base POIs by grid cell, and seed each one's corroboration with
  // its own source and attribution.
  const grid = new Map<string, PoiSummary[]>()
  const corroboration = new Map<PoiSummary, Corroboration>()
  for (const base of basePois) {
    const key = cellKey(base)
    const bucket = grid.get(key)
    if (bucket === undefined) {
      grid.set(key, [base])
    } else {
      bucket.push(base)
    }
    corroboration.set(base, { slugs: [base.source], attributions: [base.attribution] })
  }

  /** Find a base POI of the same type within radiusMeters of `poi`. */
  function baseMatch (poi: PoiSummary): PoiSummary | undefined {
    const x = Math.floor((poi.position.longitude * lonScale) / radiusMeters)
    const y = Math.floor((poi.position.latitude * METERS_PER_DEGREE) / radiusMeters)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = grid.get(`${x + dx},${y + dy}`)
        if (bucket === undefined) continue
        for (const base of bucket) {
          if (base.type === poi.type &&
            distanceMeters(base.position, poi.position) <= radiusMeters) {
            return base
          }
        }
      }
    }
    return undefined
  }

  // Non-base POIs: merge a dedupe-enabled duplicate into its base, otherwise
  // keep it.
  const survivors: PoiSummary[] = []
  for (const poi of pois) {
    if (poi.source === BASE_SOURCE_ID) {
      continue
    }
    if (!dedupeSources.has(poi.source)) {
      // Not a dedupe-enabled source: never merged or dropped.
      survivors.push(poi)
      continue
    }
    const base = baseMatch(poi)
    if (base === undefined) {
      // Dedupe-enabled but no co-located base POI: pass through unmerged.
      survivors.push({ ...poi, sources: [poi.source] })
      continue
    }
    const merged = corroboration.get(base)
    if (merged !== undefined && !merged.slugs.includes(poi.source)) {
      merged.slugs.push(poi.source)
      if (!merged.attributions.includes(poi.attribution)) {
        merged.attributions.push(poi.attribution)
      }
    }
  }

  // Emit the base POIs (always survivors) with their final corroboration, then
  // the surviving non-base POIs.
  const baseSurvivors = basePois.map((base): PoiSummary => {
    const merged = corroboration.get(base) ?? { slugs: [base.source], attributions: [base.attribution] }
    return { ...base, sources: merged.slugs, attribution: merged.attributions.join('; ') }
  })
  return [...baseSurvivors, ...survivors]
}
