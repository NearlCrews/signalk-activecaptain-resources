/**
 * Input registry.
 *
 * Holds the registered `InputModule`s, exposes their config-schema fragments,
 * and builds the aggregate `PoiSource` for a plugin start. The aggregate fans
 * every call out to each enabled source, namespaces resource ids with the
 * producing source's slug, and unions the results, so the `notes` output sees
 * one source regardless of how many inputs are enabled.
 */

import type { InputContext, InputModule, PoiSource } from './poi-source.js'
import type { PoiSummary } from '../shared/types.js'

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
      const enabled = modules.filter((module) => module.isEnabled(context.config))
      if (enabled.length === 0) {
        throw new Error('Cannot build a POI source: no input is enabled')
      }
      const sources = new Map<string, PoiSource>()
      for (const module of enabled) {
        sources.set(module.id, module.createSource(context))
      }
      return {
        id: 'aggregate',
        listPointsOfInterest: async (bbox, poiTypes) => {
          const results = await Promise.allSettled(
            [...sources.values()].map((s) => s.listPointsOfInterest(bbox, poiTypes)))
          const merged: PoiSummary[] = []
          let anyOk = false
          results.forEach((result, index) => {
            const sourceId = [...sources.keys()][index]
            if (result.status === 'fulfilled') {
              anyOk = true
              for (const poi of result.value) {
                merged.push({ ...poi, id: `${sourceId}-${poi.id}` })
              }
            } else {
              context.status.recordError(
                `List from "${sourceId}" failed: ${String(result.reason)}`)
            }
          })
          if (!anyOk) {
            throw new Error('Every POI source failed the list request')
          }
          return merged
        },
        getDetails: async (id) => {
          // Split on the FIRST hyphen only: a raw id (an OSM id such as
          // `node/987654`) can itself contain hyphens or slashes.
          const hyphen = id.indexOf('-')
          const sourceId = hyphen > 0 ? id.slice(0, hyphen) : ''
          const rawId = hyphen > 0 ? id.slice(hyphen + 1) : id
          const source = sources.get(sourceId)
          if (source === undefined) {
            throw new Error(`No source for resource id "${id}"`)
          }
          return await source.getDetails(rawId)
        },
        cacheSize: () => [...sources.values()].reduce((sum, s) => sum + s.cacheSize(), 0),
        close: () => { for (const s of sources.values()) s.close() }
      }
    }
  }
}
