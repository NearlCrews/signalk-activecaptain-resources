/**
 * Source-slug constants shared by the input modules and the configuration
 * panel.
 *
 * The constants would naturally live in each input's source module (next
 * to the rest of that source's code), but the panel cannot import from
 * those modules: the panel is bundled by webpack for the browser, and
 * the input source modules transitively reach `node:fs` and `node:path`
 * via their on-disk stores. Defining the slugs in this dependency-free
 * module keeps them one canonical export consumed by both sides.
 *
 * Renaming any of these is a single-site change and produces TypeScript
 * compile errors at every consumer (input registry, status recorder,
 * panel slug type, panel disclosure map).
 */

/** The Garmin ActiveCaptain source. The fixed base every other source dedupes against. */
export const ACTIVE_CAPTAIN_SOURCE_ID = 'activecaptain'

/** The OpenSeaMap (OSM Overpass) source. */
export const OPENSEAMAP_SOURCE_ID = 'openseamap'

/** The USCG Light List source. */
export const USCG_LIGHT_LIST_SOURCE_ID = 'usclightlist'

/** The NOAA ENC Direct source. */
export const NOAA_ENC_SOURCE_ID = 'noaaenc'

/**
 * The union of source slugs the plugin recognizes. The panel keys its
 * disclosure-state map on this; a typo in any slug literal produces a
 * compile error here AND in the panel.
 */
export type SourceSlug =
  | typeof ACTIVE_CAPTAIN_SOURCE_ID
  | typeof OPENSEAMAP_SOURCE_ID
  | typeof USCG_LIGHT_LIST_SOURCE_ID
  | typeof NOAA_ENC_SOURCE_ID
