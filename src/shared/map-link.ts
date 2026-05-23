/**
 * Public-map deep-link builders for POI "view this in a browser" buttons.
 *
 * Two of the plugin's sources have no canonical per-feature viewer:
 *
 * - NAVCEN's old Light List search-result deep link (`/light-list-search-results?...`)
 *   was retired when NAVCEN migrated to Drupal in 2020; the MSI app at
 *   `navcen.uscg.gov/msi` has no per-LLNR URL routing.
 *   (https://www.navcen.uscg.gov/LNM-and-LL-app-frequently-asked-questions)
 *
 * - NOAA's ENC Direct viewer at `encdirect.noaa.gov` is an Esri Web
 *   AppBuilder shell with a 2020-stale configuration that ignores the
 *   documented `?center=lon,lat&level=z` URL parameters and lands blank
 *   regardless of input.
 *   (https://doc.arcgis.com/en/web-appbuilder/latest/manage-apps/app-url-parameters.htm)
 *
 * Both sources therefore fall back to an OpenSeaMap marker deep link. The
 * popup body still names the source-specific identifier (LLNR for USCG,
 * `DSNM` chart cell and survey date for NOAA) so a mariner can cross-reference
 * the feature back to its USCG or NOAA publication manually.
 *
 * OpenSeaMap is chosen over plain OpenStreetMap because it renders the
 * marine seamark overlay (lights, buoys, depth contours) on top of the OSM
 * base, and many US navaids are already mirrored from the Light List into
 * OSM under the `seamark:light:*` tag family, so the marker often lands on
 * the matching aid.
 *
 * Marker URL format per the OpenSeaMap wiki:
 *   https://wiki.openseamap.org/wiki/h:En:Marker_in_URL
 */

/**
 * Build an OpenSeaMap marker deep link centered on the given lat/lon. The
 * marker parameters (`mlat`, `mlon`) drop a pin so the feature is visible
 * without zooming around.
 */
export function openSeaMapMarkerUrl (latitude: number, longitude: number): string {
  const lat = encodeURIComponent(String(latitude))
  const lon = encodeURIComponent(String(longitude))
  return `https://map.openseamap.org/?zoom=15&lat=${lat}&lon=${lon}&mlat=${lat}&mlon=${lon}`
}
