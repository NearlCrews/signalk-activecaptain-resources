/**
 * Year filter for source-tagged points of interest.
 *
 * Each opting-in source populates `PoiSummary.timestamp` from its own wire
 * date (NOAA ENC `SORDAT`, USCG `MODIFIED_DATE`, OSM element `timestamp`,
 * etc.); this helper then drops entries whose ISO-8601 timestamp parses to a
 * year strictly older than the configured minimum.
 *
 * The contract mirrors the existing rating filter in
 * `src/inputs/active-captain/rating-filter.ts`:
 *
 * - `0` (the off sentinel) returns the input unchanged. Existing installs
 *   that have not set the field see no behavior change.
 * - A POI with no `timestamp` is always included. The filter only narrows;
 *   a source whose wire data carries no date never disappears from the chart.
 * - An unparseable `timestamp` is treated as absent (included). A malformed
 *   string should never silently drop data on a behalf the wire did not
 *   authorize.
 */

import type { PoiSummary } from './types.js'

/**
 * Drop every POI whose `timestamp` year is strictly less than
 * `minimumYear`. Pure function: returns a fresh array, never mutates the
 * input. The input itself is returned by reference when the filter is a
 * no-op (`minimumYear` is 0 or every POI passes), so the common case
 * allocates nothing.
 */
export function filterByMinimumYear (
  pois: readonly PoiSummary[],
  minimumYear: number
): readonly PoiSummary[] {
  if (!Number.isFinite(minimumYear) || minimumYear <= 0) {
    return pois
  }
  return pois.filter((poi) => isOnOrAfter(poi.timestamp, minimumYear))
}

/**
 * True when `timestamp` parses to a year that is greater than or equal to
 * `minimumYear`. Undefined and unparseable timestamps return true so the
 * filter never drops a POI on absent or malformed wire data.
 */
function isOnOrAfter (timestamp: string | undefined, minimumYear: number): boolean {
  if (timestamp === undefined) return true
  const parsedMs = Date.parse(timestamp)
  if (!Number.isFinite(parsedMs)) return true
  const year = new Date(parsedMs).getUTCFullYear()
  return year >= minimumYear
}
