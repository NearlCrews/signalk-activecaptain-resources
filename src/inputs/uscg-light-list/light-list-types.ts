/**
 * Wire and parsed types for the USCG Light List GeoJSON feed.
 *
 * The MSI GeoJSON files at navcen.uscg.gov return a standard FeatureCollection
 * with one Feature per Aid to Navigation. The wire shape carries every USCG
 * field; the parsed shape (LightListRecord) strips the fields the plugin
 * never displays.
 */

import type { Position } from '../../shared/types.js'

/** A single USCG Light List feature off the wire. */
export interface LightListFeature {
  type: 'Feature'
  id?: number | string
  geometry: { type: 'Point', coordinates: [number, number] }
  properties: LightListProperties
}

/** Every wire property the USCG MSI feed publishes that the plugin reads. */
export interface LightListProperties {
  LIGHT_LIST_NUMBER: number
  NAME: string
  DECIMAL_LATITUDE: number
  DECIMAL_LONGITUDE: number
  LIGHT_CHAR?: string
  COLOR?: string
  LIGHT_NOM_RANGE?: number
  LIGHT_NOM_RANGE_UNIT?: string
  LIGHT_FOCAL_PLANE?: number
  LIGHT_FOCAL_PLANE_UNIT?: string
  STRUCTURE_TYPE?: string
  STRUCTURE_HEIGHT?: number
  STRUCTURE_HEIGHT_UNIT?: string
  DAYMARK_SHAPE?: string
  DAYMARK_COLOR?: string
  SOUND_EMITTER_TYPE?: string
  RACON_MORSE_CHARACTER?: string
  AID_TYPE?: string
  AID_SUBTYPE?: string
  REMARK?: string
  VOLUME_NUMBER: number
  MODIFIED_DATE?: number
  INACTIVE?: string
  // Other fields exist on the wire; the client ignores them on parse.
}

/** A single Light List feature as stored in the plugin's in-memory index. */
export interface LightListRecord {
  llnr: number
  name: string
  position: Position
  lightChar?: string
  color?: string
  nominalRange?: { value: number, unit: string }
  focalPlane?: { value: number, unit: string }
  structureType?: string
  structureHeight?: { value: number, unit: string }
  daymarkShape?: string
  daymarkColor?: string
  soundEmitterType?: string
  racon?: string
  aidType?: string
  aidSubtype?: string
  remark?: string
  district: string
  volume: number
  source: 'usclightlist'
  modifiedDate?: string
  inactive: boolean
}

/** Headers from a successful GeoJSON download, used for conditional GET. */
export interface DistrictHeaders {
  lastModified?: string
  etag?: string
}

/** Metadata about one downloaded district file. */
export interface DistrictMeta extends DistrictHeaders {
  recordCount: number
  fetchedAt: string
}

/** The on-disk index: per-district metadata plus the merged record map. */
export interface LightListIndex {
  generated: string
  districts: Record<string, DistrictMeta>
  records: Record<string, LightListRecord>
}
