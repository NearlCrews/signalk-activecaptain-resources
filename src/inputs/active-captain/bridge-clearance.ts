/**
 * Convert an ActiveCaptain fixed-bridge clearance to SI meters.
 *
 * ActiveCaptain's `NavigationSection` reports `bridgeHeight` in whatever
 * `distanceUnit` the point of interest was tagged in, either feet or meters.
 * The bridge air-draft check needs SI meters, so this converts a positive
 * `bridgeHeight` by its unit and returns `undefined` for anything it cannot
 * trust.
 *
 * The unit is never guessed: a wrong feet-versus-meters conversion is a safety
 * bug, so an absent or unrecognized `distanceUnit` yields `undefined`, not a
 * value. A `bridgeHeight` of 0 or missing is also `undefined`, matching the
 * detail template's `{{#if bridgeHeight}}` gate, where 0 means "no fixed-bridge
 * clearance recorded."
 */

import { metersFromFeet } from '../../shared/length.js'
import { positiveFiniteNumber } from '../../shared/numbers.js'

/** `distanceUnit` spellings ActiveCaptain uses for feet, lowercased. */
const FEET_UNITS: ReadonlySet<string> = new Set(['feet', 'ft', 'foot'])

/** `distanceUnit` spellings ActiveCaptain uses for meters, lowercased. */
const METER_UNITS: ReadonlySet<string> = new Set(['meters', 'metres', 'meter', 'm'])

/**
 * Convert `bridgeHeight` to SI meters using `distanceUnit`, or `undefined`
 * when the height is non-positive, or the unit is absent or unrecognized.
 */
export function bridgeHeightToMeters (
  bridgeHeight: number | undefined,
  distanceUnit: string | undefined
): number | undefined {
  const height = positiveFiniteNumber(bridgeHeight)
  if (height === null || typeof distanceUnit !== 'string') {
    return undefined
  }
  const unit = distanceUnit.trim().toLowerCase()
  if (FEET_UNITS.has(unit)) {
    return metersFromFeet(height)
  }
  if (METER_UNITS.has(unit)) {
    return height
  }
  return undefined
}
