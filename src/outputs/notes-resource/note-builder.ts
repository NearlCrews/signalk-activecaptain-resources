/**
 * SignalK `notes` resource builder.
 *
 * Pure helpers that turn a point of interest into a SignalK `notes` resource
 * object and read a dot-notation property path back out of one. The shape is
 * shared by the list and single-resource responses.
 */

import { PLUGIN_ID } from '../../shared/plugin-id.js'
import type { Position } from '../../shared/types.js'

/**
 * Build a SignalK `notes` resource object. The shape is shared by the list and
 * single-resource responses. `url`, `source`, and `attribution` are
 * source-specific values carried on the POI data. `timestamp` is included only
 * when a genuine resource timestamp is known (the list endpoint does not
 * supply one), and `description`, which is rendered HTML, is included only when
 * supplied.
 */
export function buildNoteResource (
  name: string,
  position: Position,
  skIcon: string,
  url: string,
  source: string,
  attribution: string,
  timestamp?: string,
  description?: string
): Record<string, unknown> {
  const note: Record<string, unknown> = {
    name,
    position,
    url,
    properties: {
      readOnly: true,
      skIcon,
      source,
      attribution
    },
    $source: PLUGIN_ID
  }
  if (timestamp !== undefined) {
    note.timestamp = timestamp
  }
  if (description !== undefined) {
    // The description is rendered HTML, so the note must declare text/html
    // rather than mislabel the markup as plain text.
    note.description = description
    note.mimeType = 'text/html'
  }
  return note
}

/** Read a dot-notation property path out of a note object. */
export function readProperty (note: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value !== null && typeof value === 'object') {
      return (value as Record<string, unknown>)[key]
    }
    return undefined
  }, note)
}
