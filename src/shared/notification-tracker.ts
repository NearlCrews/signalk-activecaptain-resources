/**
 * Shared raise/clear bookkeeping for the plugin's alarm outputs.
 *
 * Both the proximity-alarm and the route-hazard outputs keep a map of
 * currently-alarming points of interest and have to clear each one with a
 * single `state: 'normal'` notification at exit and a full sweep at plugin
 * stop. The entry-and-refresh logic differs between the two outputs (the
 * proximity output applies hysteresis, the route output also refreshes the
 * message when the distance or ETA changes), but the clear half is the same
 * shape on both, so this module owns it.
 *
 * A caller creates a tracker with the notification path prefix and a
 * `buildClearValue` callback, then drives entries with `set` / `clear`. The
 * raise step lives in the caller because that is where the two outputs
 * legitimately disagree.
 */

import {
  emitNotification,
  type NotificationEmitterApp,
  type NotificationValue
} from './notification-path.js'

/** The slice of the SignalK app a tracker needs for emit and debug logging. */
export interface NotificationTrackerApp extends NotificationEmitterApp {
  debug: (message: string) => void
}

/** Inputs for {@link createNotificationTracker}. */
export interface NotificationTrackerConfig<T> {
  app: NotificationTrackerApp
  /** Notification path prefix, completed with the sanitized POI id. */
  pathPrefix: string
  /**
   * Optional `$source` suffix appended to the plugin id, so the clear
   * delta shares the per-output `$source` brand the raise carries.
   */
  sourceSuffix?: string
  /** Build the `state: 'normal'` notification value for an entry being cleared. */
  buildClearValue: (entry: T) => NotificationValue
  /** Optional debug log emitted on each clear, given the POI id and entry. */
  describeClear?: (poiId: string, entry: T) => string
}

/** Public surface of the tracker. */
export interface NotificationTracker<T> {
  /** True when the POI id is currently in the alarm state. */
  has: (poiId: string) => boolean
  /** The active entry for `poiId`, or `undefined` when none. */
  get: (poiId: string) => T | undefined
  /** Mark `poiId` as currently alarming and store its entry. */
  set: (poiId: string, entry: T) => void
  /** Iterate the currently-active entries. */
  entries: () => IterableIterator<[string, T]>
  /**
   * Clear a single alarming entry: emit its clear notification, drop it from
   * the active set, and optionally log. A no-op when `poiId` is not active.
   */
  clear: (poiId: string) => void
  /** Clear every active entry. Called on plugin stop. */
  clearAll: () => void
}

/** Create an alarm tracker bound to the given app and notification path. */
export function createNotificationTracker<T> (
  config: NotificationTrackerConfig<T>
): NotificationTracker<T> {
  const { app, pathPrefix, sourceSuffix, buildClearValue, describeClear } = config
  const active = new Map<string, T>()

  function clear (poiId: string): void {
    const entry = active.get(poiId)
    if (entry === undefined) {
      return
    }
    emitNotification(app, pathPrefix, poiId, buildClearValue(entry), sourceSuffix)
    active.delete(poiId)
    if (describeClear !== undefined) {
      app.debug(describeClear(poiId, entry))
    }
  }

  function clearAll (): void {
    // Snapshot the keys first: clear() deletes from the map as it iterates.
    for (const poiId of [...active.keys()]) {
      clear(poiId)
    }
  }

  return {
    has: (poiId) => active.has(poiId),
    get: (poiId) => active.get(poiId),
    set: (poiId, entry) => { active.set(poiId, entry) },
    entries: () => active.entries(),
    clear,
    clearAll
  }
}
