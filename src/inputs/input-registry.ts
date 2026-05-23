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
import { BASE_SOURCE_ID, dedupeAgainstBase } from './dedupe-pois.js'
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
      // Dedupe runs only when the ActiveCaptain base layer is enabled and at
      // least one non-base input has its per-source dedupe toggle on.
      const dedupeSources = new Set<string>()
      // Per-source merge-radius map: each non-base input contributes the
      // radius surfaced on its card. Sources that omit the contract use
      // DEFAULT_DEDUPE_RADIUS_METERS via the dedupe pass's fallback.
      const dedupeRadiusBySource = new Map<string, number>()
      if (enabled.some((module) => module.id === BASE_SOURCE_ID)) {
        for (const module of enabled) {
          if (module.id !== BASE_SOURCE_ID && module.isDedupeEnabled?.(context.config) === true) {
            dedupeSources.add(module.id)
            const radius = module.dedupeRadiusMeters?.(context.config)
            if (radius !== undefined) {
              dedupeRadiusBySource.set(module.id, radius)
            }
          }
        }
      }
      // Materialize the source list and the id list once at registry-build
      // time. Both arrays are fixed for the life of the aggregate, so the
      // per-tick `listPointsOfInterest` does not need to rebuild them on
      // every call.
      const sourceIds = [...sources.keys()]
      const sourceList = [...sources.values()]
      return {
        id: 'aggregate',
        listPointsOfInterest: async (bbox, poiTypes) => {
          const results = await Promise.allSettled(
            sourceList.map((s) => s.listPointsOfInterest(bbox, poiTypes)))
          const merged: PoiSummary[] = []
          let anyOk = false
          // The aggregate is the only component that knows each source's
          // individual list outcome, so it owns the per-source status
          // recording: a fulfilled source records its own list fetch, a
          // rejected source records its own error.
          results.forEach((result, index) => {
            const sourceId = sourceIds[index]
            if (result.status === 'fulfilled') {
              anyOk = true
              // A source that gated itself out (recordSkipped) returns []
              // immediately; treating that as a "fetched zero POIs" success
              // would overwrite the previous fetch's lastListFetch and flip
              // apiReachable to true even though no request was sent. The
              // wasJustSkipped flag distinguishes the two cases.
              if (!context.status.wasJustSkipped(sourceId)) {
                context.status.recordListFetch(sourceId, result.value.length)
              }
              // The id rewrite is done via a spread-clone, not an in-place
              // mutation: the per-source bbox-debounce caches now return the
              // same PoiSummary[] reference across hits, and mutating the
              // shared objects would re-apply the prefix on every cached
              // tick (`activecaptain-12345` becoming
              // `activecaptain-activecaptain-12345` and so on, breaking
              // detail lookup and proximity-alarm hysteresis).
              const prefix = `${sourceId}-`
              for (const poi of result.value) {
                merged.push({ ...poi, id: prefix + poi.id })
              }
            } else {
              context.status.recordError(
                sourceId, `List from "${sourceId}" failed: ${String(result.reason)}`)
            }
          })
          if (!anyOk) {
            throw new Error('Every POI source failed the list request')
          }
          // Merge each dedupe-enabled source's duplicates into the base layer,
          // so a feature reported by several sources is one corroborated note.
          return dedupeSources.size > 0
            ? dedupeAgainstBase(merged, dedupeSources, dedupeRadiusBySource)
            : merged
        },
        getDetails: async (id) => {
          // Split on the FIRST hyphen only: a raw id (an OSM id such as
          // `node_987654`) can itself contain hyphens or underscores.
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
