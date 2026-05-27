/**
 * OpenSeaMap seamark-type mapping.
 *
 * OpenSeaMap tags marine features with OpenStreetMap's `seamark:type` key.
 * This module maps those raw values onto the plugin's existing `PoiType`
 * union, so an OpenSeaMap feature flows through the same outputs (the `notes`
 * resource, the proximity alarm, and the route-corridor scan) as an
 * ActiveCaptain point of interest. The `PoiType` union is not extended: every
 * seamark value maps to an existing member.
 *
 * It also defines the seamark groups the configuration panel exposes as a
 * checklist, and builds the alternation regex the Overpass query filters on.
 */

import { SEAMARK_GROUP_REFS, type SeamarkGroupRef } from '../../shared/seamark-groups.js'
import type { PoiType } from '../../shared/types.js'

/**
 * Map a `seamark:type` value onto a `PoiType`. `rock`, `wreck`, and
 * `obstruction` become `Hazard`, so they flow into the existing proximity and
 * route-corridor alarms. An unrecognized value maps to `Unknown`.
 */
const SEAMARK_POI_TYPE: Readonly<Record<string, PoiType>> = {
  rock: 'Hazard',
  wreck: 'Hazard',
  obstruction: 'Hazard',
  harbour: 'Marina',
  marina: 'Marina',
  lock_basin: 'Lock',
  bridge: 'Bridge',
  light_major: 'Navigational',
  light_minor: 'Navigational',
  light_float: 'Navigational',
  light_vessel: 'Navigational',
  landmark: 'Navigational',
  beacon_lateral: 'Navigational',
  beacon_cardinal: 'Navigational',
  beacon_isolated_danger: 'Navigational',
  beacon_safe_water: 'Navigational',
  beacon_special_purpose: 'Navigational',
  buoy_lateral: 'Navigational',
  buoy_cardinal: 'Navigational',
  buoy_isolated_danger: 'Navigational',
  buoy_safe_water: 'Navigational',
  buoy_special_purpose: 'Navigational',
  anchorage: 'Anchorage',
  anchor_berth: 'Anchorage',
  mooring: 'Anchorage'
}

/** Map a `seamark:type` value to a `PoiType`, defaulting to `Unknown`. */
export function seamarkToPoiType (value: string): PoiType {
  return SEAMARK_POI_TYPE[value] ?? 'Unknown'
}

/**
 * Resolve the `PoiType` for an OpenSeaMap element from its OSM tags. A
 * `seamark:type` tag is mapped directly; an element with no seamark type but
 * tagged `leisure=marina` is a `Marina`. Everything else is `Unknown`.
 */
export function elementPoiType (tags: Record<string, string>): PoiType {
  const seamark = tags['seamark:type']?.trim().toLowerCase()
  if (seamark !== undefined && seamark.length > 0) {
    return seamarkToPoiType(seamark)
  }
  if (tags.leisure?.trim().toLowerCase() === 'marina') {
    return 'Marina'
  }
  return 'Unknown'
}

/**
 * Map a `seamark:type` value onto a Freeboard-SK note icon name (without the
 * `sk-` prefix the renderer applies). Freeboard registers a fixed set of POI
 * icons under that namespace, so an unregistered name silently falls back to
 * a default yellow square. Each value here is one of Freeboard's actually
 * registered icons.
 *
 * Isolated-danger buoys and beacons render with the `hazard` glyph: their
 * entire purpose is to flag a danger, so the hazard icon is the visually
 * correct cue. Their `PoiType` stays `Navigational` so they do not falsely
 * trigger the proximity alarms; the icon decoupling is what makes that
 * possible.
 */
const SEAMARK_SK_ICON: Readonly<Record<string, string>> = {
  rock: 'hazard',
  wreck: 'hazard',
  obstruction: 'hazard',
  harbour: 'marina',
  marina: 'marina',
  lock_basin: 'lock',
  bridge: 'bridge',
  light_major: 'navigation-structure',
  light_minor: 'navigation-structure',
  light_float: 'navigation-structure',
  light_vessel: 'navigation-structure',
  landmark: 'navigation-structure',
  beacon_lateral: 'navigation-structure',
  beacon_cardinal: 'navigation-structure',
  beacon_isolated_danger: 'hazard',
  beacon_safe_water: 'navigation-structure',
  beacon_special_purpose: 'navigation-structure',
  buoy_lateral: 'navigation-structure',
  buoy_cardinal: 'navigation-structure',
  buoy_isolated_danger: 'hazard',
  buoy_safe_water: 'navigation-structure',
  buoy_special_purpose: 'navigation-structure',
  anchorage: 'anchorage',
  anchor_berth: 'anchorage',
  mooring: 'anchorage'
}

/** Generic fallback icon, used when no specific Freeboard icon fits. */
const FALLBACK_SK_ICON = 'notice-to-mariners'

/**
 * Map a `seamark:type` value onto a Freeboard-SK note icon name, defaulting
 * to a generic notice glyph for an unmapped value.
 */
export function seamarkSkIcon (value: string): string {
  return SEAMARK_SK_ICON[value] ?? FALLBACK_SK_ICON
}

/**
 * Resolve the Freeboard-SK note icon for an OpenSeaMap element from its OSM
 * tags. A `seamark:type` tag is mapped directly; a `leisure=marina` element
 * with no seamark gets the `marina` icon. Anything else falls back to the
 * generic notice glyph, so a missing icon never renders as a bare yellow
 * square.
 */
export function elementSkIcon (tags: Record<string, string>): string {
  const seamark = tags['seamark:type']?.trim().toLowerCase()
  if (seamark !== undefined && seamark.length > 0) {
    return seamarkSkIcon(seamark)
  }
  if (tags.leisure?.trim().toLowerCase() === 'marina') {
    return 'marina'
  }
  return FALLBACK_SK_ICON
}

/**
 * One configurable group of seamark features the OpenSeaMap source fetches.
 * Extends the shared {@link SeamarkGroupRef} with the per-group
 * `seamark:type` values used to build the Overpass query.
 */
export interface SeamarkGroup extends SeamarkGroupRef {
  /** The `seamark:type` values this group fetches. */
  seamarkTypes: readonly string[]
}

/** Per-group `seamark:type` values, keyed by the shared group id. */
const SEAMARK_TYPES_BY_GROUP: Readonly<Record<string, readonly string[]>> = {
  hazards: ['rock', 'wreck', 'obstruction'],
  navaids: [
    'light_major', 'light_minor', 'light_float', 'light_vessel', 'landmark',
    'beacon_lateral', 'beacon_cardinal', 'beacon_isolated_danger',
    'beacon_safe_water', 'beacon_special_purpose',
    'buoy_lateral', 'buoy_cardinal', 'buoy_isolated_danger',
    'buoy_safe_water', 'buoy_special_purpose'
  ],
  harbours: ['harbour', 'anchorage', 'anchor_berth', 'mooring'],
  infrastructure: ['lock_basin', 'bridge']
}

/**
 * The seamark groups the OpenSeaMap source fetches. The id and label come from
 * the shared {@link SEAMARK_GROUP_REFS}; {@link seamarkRegex} turns the
 * enabled-group ids into the Overpass query filter.
 */
export const SEAMARK_GROUPS: readonly SeamarkGroup[] = SEAMARK_GROUP_REFS.map((ref) => ({
  ...ref,
  seamarkTypes: SEAMARK_TYPES_BY_GROUP[ref.id] ?? []
}))

/**
 * Build the anchored alternation regex an Overpass `seamark:type` filter uses,
 * covering every seamark type in the enabled groups. An unknown group id is
 * ignored. With no enabled group `types` is empty, so the regex is `^()$`,
 * which matches only the empty string: real `seamark:type` values are never
 * empty, so the filter matches no seamark feature. The list query is still
 * issued, since it also fetches `leisure=marina` elements outside the seamark
 * filter.
 */
export function seamarkRegex (groups: readonly string[]): string {
  const enabled = new Set(groups)
  const types: string[] = []
  for (const group of SEAMARK_GROUPS) {
    if (enabled.has(group.id)) {
      types.push(...group.seamarkTypes)
    }
  }
  return `^(${types.join('|')})$`
}
