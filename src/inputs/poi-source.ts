/**
 * Input contracts.
 *
 * A `PoiSource` is one upstream provider of points of interest. An
 * `InputModule` packages a source for registration: it carries the id, the
 * config-schema fragment, an enablement check, and a factory. Adding a new POI
 * data source means implementing these two interfaces and registering the
 * module in `src/index.ts`.
 */

import type { ServerAPI } from '@signalk/server-api'
import type { PluginStatus } from '../status/plugin-status.js'
import type { Bbox, PluginConfig, PoiDetailView, PoiSummary } from '../shared/types.js'

/** One upstream provider of points of interest. */
export interface PoiSource {
  /** Stable id of the source, e.g. `activecaptain`. */
  readonly id: string
  /**
   * List point-of-interest summaries within a bounding box, restricted to the
   * comma-separated, source-specific `poiTypes` filter. Rejects on failure.
   */
  listPointsOfInterest: (bbox: Bbox, poiTypes: string) => Promise<PoiSummary[]>
  /**
   * Fetch one point of interest by id as a fully rendered, source-agnostic
   * detail view. Rejects on failure.
   */
  getDetails: (id: string) => Promise<PoiDetailView>
  /** Number of detail entries currently cached, for the status snapshot. */
  cacheSize: () => number
  /** Abort in-flight work and release resources. Called on plugin stop. */
  close: () => void
}

/** Dependencies handed to an {@link InputModule} when it builds its source. */
export interface InputContext {
  /** The SignalK app. */
  app: ServerAPI
  /** The resolved plugin configuration. */
  config: PluginConfig
  /** The status recorder; a source wires API outcomes into it. */
  status: PluginStatus
  /** Absolute path to the plugin data directory, for on-disk caches. */
  dataDir: string
}

/** A registrable POI data source. */
export interface InputModule {
  /** Stable id of the input, matching the `PoiSource.id` it creates. */
  readonly id: string
  /** Human-readable name, for logs. */
  readonly name: string
  /**
   * JSON Schema `properties` fragment merged into the plugin config schema.
   * Keyed by config property name.
   */
  readonly configSchema: Record<string, unknown>
  /** True when the current configuration enables this input. */
  isEnabled: (config: PluginConfig) => boolean
  /** Build the source. Called once per plugin start. */
  createSource: (context: InputContext) => PoiSource
}
