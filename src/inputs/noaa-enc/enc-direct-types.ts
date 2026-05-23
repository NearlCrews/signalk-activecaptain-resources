/**
 * Wire types for the NOAA ENC Direct ArcGIS REST FeatureServer.
 *
 * The server returns standard GeoJSON when `f=geojson` is set, plus an
 * `exceededTransferLimit` flag the ENC Direct HTTP client uses to drive
 * pagination. The numeric ArcGIS layer ids differ per scale band, so the
 * `LAYER_IDS_BY_BAND` table is the single source of truth for every
 * `(band, layerKey)` to layer-id resolution downstream of this module.
 */

/** The ENC Direct scale bands the plugin queries. */
export type ScaleBand =
  | 'overview'
  | 'general'
  | 'coastal'
  | 'approach'
  | 'harbour'
  | 'berthing'

/** The three S-57 point hazard layers the plugin reads. */
export type EncLayerKey = 'wreck' | 'obstruction' | 'rock'

/** Numeric ArcGIS layer ids per scale band, for each hazard layer. */
export interface LayerIds {
  readonly wreck: number
  readonly obstruction: number
  readonly rock: number
}

/** One ENC Direct GeoJSON feature as returned by the FeatureServer. */
export interface EncFeature {
  type: 'Feature'
  id?: number
  geometry: { type: 'Point', coordinates: [number, number] }
  properties: Record<string, unknown>
}

/** The GeoJSON FeatureCollection ArcGIS returns from a `/query` request. */
export interface EncFeatureCollection {
  type: 'FeatureCollection'
  features: EncFeature[]
  exceededTransferLimit?: boolean
}

/**
 * Numeric ArcGIS layer ids per scale band. Discovered live from the ENC Direct
 * MapServer endpoints in Task 3.2 of the implementation plan; every entry was
 * cross-checked against `MapServer/<id>?f=json` so the id matches the layer
 * name. A `test/enc-layer-ids.test.ts` guard asserts no zero placeholders
 * survive so a contributor cannot silently ship a default-zero entry.
 */
export const LAYER_IDS_BY_BAND: Readonly<Record<ScaleBand, LayerIds>> = {
  overview: { wreck: 24, obstruction: 21, rock: 22 },
  general: { wreck: 29, obstruction: 26, rock: 27 },
  coastal: { wreck: 33, obstruction: 30, rock: 31 },
  approach: { wreck: 39, obstruction: 36, rock: 37 },
  harbour: { wreck: 36, obstruction: 33, rock: 34 },
  berthing: { wreck: 21, obstruction: 19, rock: 20 }
}
