/**
 * OpenSeaMap seamark group ids and labels, the single source of truth.
 *
 * Three places need the same list of seamark groups: the OpenSeaMap input
 * (`src/inputs/openseamap/seamark-mapping.ts`, which adds the per-group
 * `seamark:type` values used to build the Overpass query), the OpenSeaMap
 * input's plugin-config schema fragment (which uses the ids as the admin-UI
 * enum and default), and the configuration panel (which renders the labels in
 * a checklist). Each of those modules imports its view from here, so adding,
 * renaming, or removing a group is a one-line edit that updates every site.
 *
 * Labels are the canonical short form. The panel may render longer descriptive
 * labels alongside; either way, the ids are the single source of truth.
 */

/** One seamark group's stable id and its display label. */
export interface SeamarkGroupRef {
  /** Stable id, stored in the plugin configuration. */
  id: string
  /** Human-readable label. */
  label: string
}

/**
 * The seamark groups the OpenSeaMap source exposes, in display order. The id
 * is what `openSeaMapSeamarkGroups` stores and what the Overpass query filter
 * is built from.
 */
export const SEAMARK_GROUP_REFS: readonly SeamarkGroupRef[] = [
  { id: 'hazards', label: 'Hazards' },
  { id: 'navaids', label: 'Navigation aids' },
  { id: 'harbours', label: 'Harbours and moorings' },
  { id: 'infrastructure', label: 'Infrastructure' }
]

/** Every seamark group id, in display order. */
export const SEAMARK_GROUP_IDS: readonly string[] = SEAMARK_GROUP_REFS.map((group) => group.id)
