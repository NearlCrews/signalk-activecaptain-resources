/**
 * Input registry.
 *
 * Holds the registered `InputModule`s, exposes their config-schema fragments,
 * and builds the aggregate `PoiSource` for a plugin start. With one enabled
 * input the aggregate is that input's source. Aggregating several sources
 * (merging list results, namespacing ids) is deferred work, documented in the
 * design spec; this is the seam where it will go.
 */

import type { InputContext, InputModule, PoiSource } from './poi-source.js'

/** Public surface of the input registry. */
export interface InputRegistry {
  /** The registered input modules, in registration order. */
  readonly modules: readonly InputModule[]
  /** Each module's config-schema fragment, in registration order. */
  configSchemaFragments: () => Array<Record<string, unknown>>
  /**
   * Build the aggregate POI source from the enabled inputs. Throws when no
   * input is enabled, since the plugin cannot serve resources without a source.
   */
  createSource: (context: InputContext) => PoiSource
}

/** Create an input registry over a fixed set of modules. */
export function createInputRegistry (modules: readonly InputModule[]): InputRegistry {
  return {
    modules,
    configSchemaFragments: () => modules.map((module) => module.configSchema),
    createSource: (context: InputContext): PoiSource => {
      const enabled = modules.filter((module) =>
        module.isEnabled(context.config))
      if (enabled.length === 0) {
        throw new Error('Cannot build a POI source: no input is enabled')
      }
      // One source today. Multi-source aggregation is deferred (see the spec).
      return enabled[0].createSource(context)
    }
  }
}
