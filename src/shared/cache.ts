/**
 * Cache-sizing constants shared by the plugin's POI detail caches.
 *
 * Both the ActiveCaptain and the OpenSeaMap source keep an in-memory cache of
 * detail responses keyed by POI id. The ceiling lives here so the two caches
 * stay in lockstep: bumping it in one place bumps it in both.
 */

/** Hard ceiling on entries in a POI detail cache, guarding memory on long sessions. */
export const MAX_POI_CACHE_ENTRIES = 5000
