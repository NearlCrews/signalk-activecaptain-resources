/**
 * USCG Light List input module.
 *
 * Opt-in: defaults off. Owns the config-schema fragment, the periodic
 * refresh scheduler (cleared on close), and the factory that wires the
 * client, store, and source together.
 *
 * The position-gate wiring (the closure that feeds `getCurrentPosition`)
 * is completed in Phase 5 (Lane F): the plugin shell already maintains
 * the latest vessel position, and Phase 5 hands a reader to every input
 * module that opted in. Until then this module supplies a placeholder
 * that returns undefined; the source treats undefined as "unknown" and
 * runs the refresh, so the gate is effectively open until Phase 5 lands.
 *
 * The `PluginConfig` interface is extended with the Light List keys in
 * Phase 5; until then the input narrows the raw config to the local
 * shape via a focused interface cast.
 */

import {
  createUscgLightListSource,
  USCG_LIGHT_LIST_SOURCE_ID
} from './uscg-light-list-source.js'
import type { UscgLightListSource } from './uscg-light-list-source.js'
import { createLightListClient } from './light-list-client.js'
import { createLightListStore } from './light-list-store.js'
import type { InputContext, InputModule } from '../poi-source.js'
import { MS_PER_MINUTE } from '../../shared/time.js'
import type { PluginConfig, Position } from '../../shared/types.js'

/** Default background refresh period, in hours. */
const DEFAULT_REFRESH_HOURS = 6

/** Lower and upper bounds on the configurable refresh period, in hours. */
const MIN_REFRESH_HOURS = 1
const MAX_REFRESH_HOURS = 168

/** Delay before the first refresh fires after a plugin start, in seconds. */
const INITIAL_REFRESH_DELAY_SECONDS = 30

/** Minute-to-hour and second-to-millisecond derived factors. */
const MINUTES_PER_HOUR = 60
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR
const MS_PER_SECOND = 1000

/**
 * Light List slice of the plugin config. Phase 5 extends `PluginConfig`
 * with these keys; until then the input narrows raw config to this
 * shape via a focused cast.
 */
interface UscgLightListConfig {
  uscgLightListEnabled?: boolean
  uscgLightListDedupe?: boolean
  uscgLightListRefreshHours?: number
}

/** Read the Light List slice of the raw plugin config. */
function readConfig (config: PluginConfig): UscgLightListConfig {
  return config as PluginConfig & UscgLightListConfig
}

/** The enable, dedupe, and refresh-period config fragment. */
const CONFIG_SCHEMA: Record<string, unknown> = {
  uscgLightListEnabled: {
    type: 'boolean',
    title: 'Import points of interest from the USCG Light List (US Aids to Navigation)',
    default: false
  },
  uscgLightListDedupe: {
    type: 'boolean',
    title: 'Merge USCG Light List points of interest that duplicate an ActiveCaptain marker',
    default: true
  },
  uscgLightListRefreshHours: {
    type: 'number',
    title: 'USCG Light List background refresh period, in hours',
    default: DEFAULT_REFRESH_HOURS,
    minimum: MIN_REFRESH_HOURS,
    maximum: MAX_REFRESH_HOURS
  }
}

/** Resolve the refresh period from raw config, clamping to the allowed range. */
function resolveRefreshHours (raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_REFRESH_HOURS
  }
  if (raw < MIN_REFRESH_HOURS) return MIN_REFRESH_HOURS
  if (raw > MAX_REFRESH_HOURS) return MAX_REFRESH_HOURS
  return raw
}

/** The USCG Light List input module. */
export const uscgLightListInput: InputModule = {
  id: USCG_LIGHT_LIST_SOURCE_ID,
  name: 'USCG Light List',
  configSchema: CONFIG_SCHEMA,
  isEnabled: (config: PluginConfig) => readConfig(config).uscgLightListEnabled === true,
  // Dedupe defaults on: an absent toggle still merges Light List entries
  // that duplicate an ActiveCaptain marker. Only an explicit false turns
  // it off, matching the OpenSeaMap input.
  isDedupeEnabled: (config: PluginConfig) => readConfig(config).uscgLightListDedupe !== false,
  createSource: (context: InputContext) => {
    const { app, config, status, dataDir } = context
    const client = createLightListClient()
    const store = createLightListStore(dataDir)
    // Phase 5 (Lane F) wires the position-gate by replacing this placeholder
    // with a reader against the plugin's position monitor.
    const getCurrentPosition = (): Position | undefined => undefined
    // The on-disk load is kicked off here so a refresh fired by the
    // scheduler reads a hot index; failures are logged but do not block
    // plugin start: the store falls back to an empty index, which the
    // next successful refresh repopulates from upstream.
    store.load().catch(error => {
      app.debug(`USCG Light List index load failed: ${String(error)}`)
    })
    const source: UscgLightListSource = createUscgLightListSource({
      client,
      store,
      status,
      getCurrentPosition
    })
    const refreshHours = resolveRefreshHours(readConfig(config).uscgLightListRefreshHours)
    const intervalMs = refreshHours * MS_PER_HOUR
    const delayMs = INITIAL_REFRESH_DELAY_SECONDS * MS_PER_SECOND
    const initialTimer = setTimeout(() => {
      source.refreshAll().catch(error => {
        app.debug(`USCG Light List initial refresh failed: ${String(error)}`)
      })
    }, delayMs)
    const periodicTimer = setInterval(() => {
      source.refreshAll().catch(error => {
        app.debug(`USCG Light List refresh failed: ${String(error)}`)
      })
    }, intervalMs)
    const originalClose = source.close.bind(source)
    source.close = () => {
      clearTimeout(initialTimer)
      clearInterval(periodicTimer)
      originalClose()
    }
    return source
  }
}
