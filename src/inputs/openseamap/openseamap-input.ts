/**
 * OpenSeaMap input module.
 *
 * Registers OpenSeaMap (OpenStreetMap marine data, fetched through the
 * Overpass API) as a POI source. Owns the config-schema fragment for the
 * enable toggle, the Overpass endpoint URL, and the seamark feature groups to
 * import. Unlike the ActiveCaptain input, it is opt-in: `isEnabled` follows
 * the `openSeaMapEnabled` toggle, which defaults off.
 */

import { createOverpassClient } from './overpass-client.js'
import { createOpenSeaMapSource, OPENSEAMAP_SOURCE_ID } from './openseamap-source.js'
import { DEFAULT_DEDUPE_RADIUS_METERS } from '../dedupe-pois.js'
import type { InputContext, InputModule } from '../poi-source.js'
import { SEAMARK_GROUP_IDS } from '../../shared/seamark-groups.js'
import type { PluginConfig } from '../../shared/types.js'

/** Default Overpass interpreter URL when configuration omits one. */
const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter'

/**
 * Bounds and default for the optional minimum-year filter. `0` is the off
 * sentinel matching the existing rating-filter convention; the upper bound
 * is a four-digit cap that lets a user pick a future year without any
 * clamp logic getting in the way.
 */
const MIN_YEAR = 0
const MAX_YEAR = 9999
const DEFAULT_MINIMUM_YEAR = 0

/** The enable, endpoint, seamark-group, dedupe, and radius config fragment. */
const CONFIG_SCHEMA: Record<string, unknown> = {
  openSeaMapEnabled: {
    type: 'boolean',
    title: 'Import points of interest from OpenSeaMap (OpenStreetMap marine data)',
    default: false
  },
  openSeaMapEndpoint: {
    type: 'string',
    title: 'Overpass API endpoint URL',
    default: DEFAULT_ENDPOINT
  },
  openSeaMapSeamarkGroups: {
    type: 'array',
    title: 'OpenSeaMap feature groups to import',
    items: { type: 'string', enum: [...SEAMARK_GROUP_IDS] },
    default: [...SEAMARK_GROUP_IDS]
  },
  openSeaMapDedupe: {
    type: 'boolean',
    title: 'Merge OpenSeaMap points of interest that duplicate an ActiveCaptain marker',
    default: true
  },
  openSeaMapDedupeRadiusMeters: {
    type: 'number',
    title: 'Merge radius for OpenSeaMap points of interest, in meters',
    default: DEFAULT_DEDUPE_RADIUS_METERS,
    minimum: 1
  },
  openSeaMapMinimumYear: {
    type: 'number',
    title: 'Earliest OpenSeaMap update year (0 to import every element)',
    default: DEFAULT_MINIMUM_YEAR,
    minimum: MIN_YEAR,
    maximum: MAX_YEAR
  }
}

/** Resolve the minimum-year filter from raw config, clamping to the allowed range. */
function resolveMinimumYear (raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_MINIMUM_YEAR
  }
  if (raw < MIN_YEAR) return MIN_YEAR
  if (raw > MAX_YEAR) return MAX_YEAR
  return Math.trunc(raw)
}

/** Resolve the Overpass endpoint from raw config, applying the default. */
function resolveEndpoint (raw: unknown): string {
  if (typeof raw !== 'string') {
    return DEFAULT_ENDPOINT
  }
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_ENDPOINT
}

/** Resolve the seamark groups from raw config, applying the all-groups default. */
function resolveSeamarkGroups (raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [...SEAMARK_GROUP_IDS]
  }
  return raw.filter((group): group is string => typeof group === 'string')
}

/** The OpenSeaMap input module. */
export const openSeaMapInput: InputModule = {
  id: OPENSEAMAP_SOURCE_ID,
  name: 'OpenSeaMap',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config: PluginConfig) => config.openSeaMapEnabled === true,
  // Dedupe defaults on: an absent toggle still merges OpenSeaMap duplicates of
  // an ActiveCaptain marker. Only an explicit false turns it off.
  isDedupeEnabled: (config: PluginConfig) => config.openSeaMapDedupe !== false,
  createSource: (context: InputContext) => {
    const { app, config, status } = context
    return createOpenSeaMapSource({
      client: createOverpassClient(resolveEndpoint(config.openSeaMapEndpoint), app),
      seamarkGroups: resolveSeamarkGroups(config.openSeaMapSeamarkGroups),
      minimumYear: resolveMinimumYear(config.openSeaMapMinimumYear),
      status
    })
  }
}
