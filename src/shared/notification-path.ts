/**
 * Helpers for building SignalK notification paths.
 *
 * A notification path is dot-delimited, so any dynamic segment embedded in one
 * must be free of characters that would silently fork the path. The proximity
 * and route-hazard alarm outputs both embed a point-of-interest id, so the
 * sanitizer that makes an id path-safe lives here and is shared by both.
 */

/**
 * Make a POI id safe to embed in a dot-delimited SignalK path. ActiveCaptain
 * ids are numeric, but the alarm outputs' `evaluate` is a public entry point:
 * a stray `.` would silently fork the notification onto a different path, so
 * any character outside `[A-Za-z0-9_-]` is replaced.
 */
export function sanitizePoiId (poiId: string): string {
  return poiId.replace(/[^A-Za-z0-9_-]/g, '_')
}
