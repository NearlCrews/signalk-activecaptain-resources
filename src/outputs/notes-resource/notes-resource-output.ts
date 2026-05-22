/**
 * Notes-resource output.
 *
 * Registers the SignalK `notes` resource provider that exposes points of
 * interest to chart plotters. This is the ActiveCaptain-to-notes adapter: it
 * lists POIs through the aggregate source, applies the minimum-rating display
 * filter, and renders detail descriptions. It owns the `minimumRating` config
 * property, since that is a display filter on this output.
 *
 * The resource provider is registered on every plugin start; the SignalK
 * server unregisters it on stop, so `stop()` here is a no-op.
 */

import type { ResourceProviderMethods } from '@signalk/server-api'
import type { OutputContext, OutputHandle, OutputModule } from '../output.js'
import { buildNoteResource, readProperty } from './note-builder.js'
import { resolveBbox } from './resource-query.js'
import { filterByRating } from '../../inputs/active-captain/rating-filter.js'
import { buildPoiTypesString } from '../../shared/poi-type-selection.js'
import { PLUGIN_ID } from '../../shared/plugin-id.js'
import type { PoiSummary } from '../../shared/types.js'

/** The SignalK resource type this output provides. */
const RESOURCE_TYPE = 'notes'

/** The `minimumRating` config fragment owned by this output. */
const CONFIG_SCHEMA: Record<string, unknown> = {
  minimumRating: {
    type: 'number',
    title: 'Minimum rating: hide points of interest rated below this (0 to 5; 0 shows all)',
    default: 0,
    minimum: 0,
    maximum: 5
  }
}

/** Build the resource-provider methods bound to one plugin run's context. */
function buildMethods (context: OutputContext): ResourceProviderMethods {
  const { app, config, pois } = context
  const minimumRating =
    typeof config.minimumRating === 'number' && config.minimumRating > 0
      ? config.minimumRating
      : 0

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

      entities = filterByRating(entities, minimumRating)
      const resources: Record<string, unknown> = {}
      for (const entity of entities) {
        resources[entity.id] = buildNoteResource(
          entity.name,
          { ...entity.position },
          entity.type.toLowerCase(),
          entity.url,
          entity.source,
          entity.attribution,
          entity.sources
        )
      }
      return resources
    },

    getResource: async (id: string, property?: string): Promise<object> => {
      app.debug(`Incoming request to get note ${id}${property != null ? ` property ${property}` : ''}`)
      const view = await pois.getDetails(id)
      const note = buildNoteResource(
        view.name,
        { ...view.position },
        view.type.toLowerCase(),
        view.url,
        view.source,
        view.attribution,
        // A single detail fetch routes to one source, so a getResource note
        // carries no cross-source corroboration.
        undefined,
        view.timestamp,
        view.description
      )

      if (property === undefined || property === '') {
        return note
      }
      const value = readProperty(note, property)
      if (value === undefined) {
        throw new Error(`Resource ${id} has no property ${property}`)
      }
      return { value, timestamp: note.timestamp, $source: PLUGIN_ID }
    },

    setResource: (): Promise<void> =>
      Promise.reject(new Error('ActiveCaptain resources are read-only')),

    deleteResource: (): Promise<void> =>
      Promise.reject(new Error('ActiveCaptain resources are read-only'))
  }
}

/** The notes-resource output module. */
export const notesResourceOutput: OutputModule = {
  id: 'notes-resource',
  name: 'SignalK notes resource',
  configSchema: CONFIG_SCHEMA,
  isEnabled: () => true,
  start: (context: OutputContext): OutputHandle => {
    try {
      context.app.registerResourceProvider({
        type: RESOURCE_TYPE,
        methods: buildMethods(context)
      })
    } catch (error) {
      context.app.error(`Cannot register as a ${RESOURCE_TYPE} resource provider: ${String(error)}`)
    }
    // The SignalK server unregisters resource providers on plugin stop.
    return { stop: () => {} }
  }
}
