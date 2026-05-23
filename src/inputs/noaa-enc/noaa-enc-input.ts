/**
 * NOAA ENC Direct input module.
 *
 * Opt-in: defaults off. Owns the config-schema fragment (enable toggle,
 * dedupe toggle, scale-band selector, and three per-layer toggles) and the
 * factory that wires the ArcGIS REST client and the PoiSource together.
 *
 * The position-gate wiring (the closure that feeds `getCurrentPosition`)
 * is completed in Phase 5 (Lane F): the plugin shell already maintains the
 * latest vessel position, and Phase 5 plumbs a reader to every input
 * module that opted in. Until then this module supplies a placeholder that
 * returns undefined; the source treats undefined as "unknown" and runs the
 * query, so the gate is effectively open until Phase 5 lands.
 */

import { createNoaaEncSource, NOAA_ENC_SOURCE_ID } from './noaa-enc-source.js'
import { createEncDirectClient } from './enc-direct-client.js'
import type { ScaleBand } from './enc-direct-types.js'
import type { InputContext, InputModule } from '../poi-source.js'
import type { PluginConfig, Position } from '../../shared/types.js'

/** The six ENC Direct scale bands, ordered overview to berthing. */
const SCALE_BANDS: readonly ScaleBand[] = [
  'overview', 'general', 'coastal', 'approach', 'harbour', 'berthing'
]

/** Default scale band when the configuration omits one. */
const DEFAULT_SCALE_BAND: ScaleBand = 'coastal'

/** The enable, dedupe, scale-band, and per-layer config fragment. */
const CONFIG_SCHEMA: Record<string, unknown> = {
  noaaEncEnabled: {
    type: 'boolean',
    title: 'Import wrecks, obstructions, and rocks from NOAA ENC Direct (US authoritative)',
    default: false
  },
  noaaEncDedupe: {
    type: 'boolean',
    title: 'Merge NOAA ENC points of interest that duplicate an ActiveCaptain marker',
    default: true
  },
  noaaEncScaleBand: {
    type: 'string',
    title: 'NOAA ENC chart scale band',
    enum: [...SCALE_BANDS],
    default: DEFAULT_SCALE_BAND
  },
  noaaEncIncludeWrecks: {
    type: 'boolean',
    title: 'Include NOAA ENC wrecks',
    default: true
  },
  noaaEncIncludeObstructions: {
    type: 'boolean',
    title: 'Include NOAA ENC obstructions',
    default: true
  },
  noaaEncIncludeRocks: {
    type: 'boolean',
    title: 'Include NOAA ENC underwater rocks (heavy: a coastal-band query can return tens of thousands)',
    default: false
  }
}

/** Resolve the scale band from raw config, falling back to the default. */
function resolveBand (raw: unknown): ScaleBand {
  if (typeof raw !== 'string') {
    return DEFAULT_SCALE_BAND
  }
  return (SCALE_BANDS as readonly string[]).includes(raw)
    ? raw as ScaleBand
    : DEFAULT_SCALE_BAND
}

/** The NOAA ENC Direct input module. */
export const noaaEncInput: InputModule = {
  id: NOAA_ENC_SOURCE_ID,
  name: 'NOAA ENC Direct',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config: PluginConfig) => config.noaaEncEnabled === true,
  // Dedupe defaults on: an absent toggle still merges NOAA ENC entries that
  // duplicate an ActiveCaptain marker. Only an explicit false turns it off,
  // matching the OpenSeaMap and Light List inputs.
  isDedupeEnabled: (config: PluginConfig) => config.noaaEncDedupe !== false,
  createSource: (context: InputContext) => {
    const { config, status } = context
    // Phase 5 (Lane F) wires the position-gate by replacing this placeholder
    // with a reader against the plugin's position monitor.
    const getCurrentPosition = (): Position | undefined => undefined
    return createNoaaEncSource({
      client: createEncDirectClient(),
      band: resolveBand(config.noaaEncScaleBand),
      // Wrecks and obstructions default on; only an explicit false turns
      // them off. Rocks default off because a coastal-band query can return
      // tens of thousands of underwater rocks; only an explicit true opts in.
      includeWrecks: config.noaaEncIncludeWrecks !== false,
      includeObstructions: config.noaaEncIncludeObstructions !== false,
      includeRocks: config.noaaEncIncludeRocks === true,
      status,
      getCurrentPosition
    })
  }
}
