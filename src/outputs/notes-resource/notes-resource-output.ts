/**
 * Notes-resource output.
 *
 * Registers the SignalK `notes` resource provider that exposes points of
 * interest to chart plotters. It lists POIs through the aggregate source and
 * renders detail descriptions. It declares no configuration of its own.
 *
 * The resource provider is registered on every plugin start; the SignalK
 * server unregisters it on stop, so `stop()` here is a no-op.
 */

import type { ResourceProviderMethods, SourceRef } from '@signalk/server-api'
import type { OutputContext, OutputHandle, OutputModule } from '../output.js'
import { buildNoteResource, readProperty } from './note-builder.js'
import { resolveBbox } from './resource-query.js'
import { buildPoiTypesString } from '../../shared/poi-type-selection.js'
import { PLUGIN_ID } from '../../shared/plugin-id.js'
import type { PoiSummary } from '../../shared/types.js'

/** The SignalK resource type this output provides. */
const RESOURCE_TYPE = 'notes'

/**
 * Error message thrown by the read-only resource methods. The SignalK
 * resources REST layer hardcodes the HTTP status for thrown errors (400 on
 * POST, 404 on PUT, 400 on DELETE) and does not read any `statusCode`
 * field off the error, so the wire status is fixed by the server; this
 * message is what reaches the client body either way.
 */
const READ_ONLY_MESSAGE = "Crow's nest notes resources are read-only"

/** Build the resource-provider methods bound to one plugin run's context. */
function buildMethods (context: OutputContext): ResourceProviderMethods {
  const { app, config, pois } = context

  return {
    listResources: async (query: Record<string, unknown>): Promise<Record<string, unknown>> => {
      app.debug(`Incoming request to list note resources - query: ${JSON.stringify(query)}`)
      const poiTypes = buildPoiTypesString(config)
      if (poiTypes === null) {
        app.debug('No POI types are selected in the configuration; returning no resources')
        return {}
      }
      const bbox = resolveBbox(query)
      if (bbox === null) {
        app.debug(`Could not derive a bounding box from query ${JSON.stringify(query)}`)
        return {}
      }

      let entities: PoiSummary[]
      try {
        entities = await pois.listPointsOfInterest(bbox, poiTypes)
      } catch (error) {
        // The aggregate source records each failed source's error onto the
        // per-source status itself; here the failure is surfaced to the
        // SignalK plugin UI and rethrown to the resource caller.
        const message = `List request failed: ${String(error)}`
        app.setPluginError(message)
        throw error
      }
      app.setPluginStatus(`${entities.length} point(s) of interest from the last search`)

      const resources: Record<string, unknown> = {}
      for (const entity of entities) {
        resources[entity.id] = buildNoteResource({
          name: entity.name,
          // Position passes through unchanged. With the per-bbox debounce
          // caches the same position reference is shared across calls and
          // into the published note; the pipeline downstream of the cache
          // is strictly read-only, so the shared reference is safe.
          position: entity.position,
          // Every source sets `skIcon` explicitly to one of Freeboard's
          // registered icons. A future source that forgets to set it falls
          // back to a known-safe Freeboard glyph rather than to
          // type.toLowerCase(), which would produce unregistered names
          // like `boatramp` or `localknowledge` and render as the default
          // yellow square.
          skIcon: entity.skIcon ?? 'notice-to-mariners',
          url: entity.url,
          source: entity.source,
          attribution: entity.attribution,
          sources: entity.sources
        })
      }
      return resources
    },

    getResource: async (id: string, property?: string): Promise<object> => {
      app.debug(`Incoming request to get note ${id}${property != null ? ` property ${property}` : ''}`)
      const view = await pois.getDetails(id)
      // A single detail fetch routes to one source, so a getResource note
      // carries no cross-source corroboration.
      const note = buildNoteResource({
        name: view.name,
        // Sources return a fresh position per call, so the reference is
        // safe to pass through unchanged.
        position: view.position,
        // Same Freeboard-safe fallback as the list path above.
        skIcon: view.skIcon ?? 'notice-to-mariners',
        url: view.url,
        source: view.source,
        attribution: view.attribution,
        timestamp: view.timestamp,
        description: view.description
      })

      if (property === undefined || property === '') {
        return note
      }
      const value = readProperty(note, property)
      if (value === undefined) {
        throw new Error(`Resource ${id} has no property ${property}`)
      }
      return { value, timestamp: note.timestamp, $source: PLUGIN_ID as SourceRef }
    },

    setResource: (): Promise<void> =>
      Promise.reject(new Error(READ_ONLY_MESSAGE)),

    deleteResource: (): Promise<void> =>
      Promise.reject(new Error(READ_ONLY_MESSAGE))
  }
}

/** The notes-resource output module. */
export const notesResourceOutput: OutputModule = {
  id: 'notes-resource',
  name: 'SignalK notes resource',
  configSchema: {},
  isEnabled: () => true,
  start: (context: OutputContext): OutputHandle => {
    // Let the registration error propagate so the output registry marks
    // this output as failed and surfaces it via setPluginError. Swallowing
    // it here would let the plugin report "Ready" while the core data
    // path is dead.
    context.app.registerResourceProvider({
      type: RESOURCE_TYPE,
      methods: buildMethods(context)
    })
    // The SignalK server unregisters resource providers on plugin stop.
    return { stop: () => {} }
  }
}
