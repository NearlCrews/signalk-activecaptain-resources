/**
 * UI metadata for the POI-type section of the configuration panel: the four
 * labeled groups and the human-readable label for each toggle. Every flag is
 * one of the includeX booleans on PluginConfig, so all 13 POI types appear
 * exactly once across the groups.
 */

import type { PoiTypeFlag } from '../types.js'

/** A single POI-type toggle: its PluginConfig flag and its display label. */
export interface PoiTypeOption {
  flag: PoiTypeFlag
  label: string
}

/** A labeled group of related POI-type toggles. */
export interface PoiTypeGroup {
  title: string
  options: readonly PoiTypeOption[]
}

/** The four POI-type groups, in display order. */
export const POI_TYPE_GROUPS: readonly PoiTypeGroup[] = [
  {
    title: 'Berthing and services',
    options: [
      { flag: 'includeMarinas', label: 'Marinas' },
      { flag: 'includeAnchorages', label: 'Anchorages' },
      { flag: 'includeBoatRamps', label: 'Boat ramps' },
      { flag: 'includeBusinesses', label: 'Businesses' }
    ]
  },
  {
    title: 'Navigation and hazards',
    options: [
      { flag: 'includeHazards', label: 'Hazards' },
      { flag: 'includeInlets', label: 'Inlets' },
      { flag: 'includeNavigational', label: 'Navigational aids' }
    ]
  },
  {
    title: 'Infrastructure',
    options: [
      { flag: 'includeBridges', label: 'Bridges' },
      { flag: 'includeDams', label: 'Dams' },
      { flag: 'includeFerries', label: 'Ferries' },
      { flag: 'includeLocks', label: 'Locks' }
    ]
  },
  {
    title: 'Other',
    options: [
      { flag: 'includeLocalKnowledge', label: 'Local knowledge' },
      { flag: 'includeAirports', label: 'Airports' }
    ]
  }
]
