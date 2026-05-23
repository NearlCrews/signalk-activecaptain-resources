/**
 * NOAA ENC Direct ArcGIS REST client.
 *
 * Issues bbox-bounded `/query` requests against the per-scale-band ENC Direct
 * MapServers and returns standard GeoJSON features. ArcGIS caps a single
 * response at 1000 records, so the client pages while the upstream returns
 * `exceededTransferLimit: true`. The numeric layer id is resolved from
 * `(band, layerKey)` via `LAYER_IDS_BY_BAND`, so the call sites never
 * hard-code layer ids.
 *
 * Every request includes the bounding-box geometry filter: an unbounded
 * `where=1=1` query times out at the harbour scale band (observed during
 * research), so the client deliberately constructs the URL such that
 * `geometry` is always present and `where` never replaces it.
 *
 * The ENC Direct service requires a descriptive `User-Agent`: a request with
 * the default Node UA never returns. The plugin's own user-agent string is
 * sent on every request.
 */

import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import {
  LAYER_IDS_BY_BAND,
  type EncFeature,
  type EncLayerKey,
  type ScaleBand
} from './enc-direct-types.js'
import type { Bbox } from '../../shared/types.js'

const USER_AGENT =
  'signalk-crows-nest (+https://github.com/nlabadie/signalk-crows-nest)'

const DEFAULT_BASE_URL = 'https://gis.charttools.noaa.gov'

/** ArcGIS' per-response cap. The client pages while the upstream signals more. */
const PAGE_SIZE = 1000

/**
 * Upper bound on pagination passes per `queryLayer` call. The largest ENC
 * layer observed live (coastal-band rocks) caps at ~43k features, eight pages
 * below this bound. A misbehaving server that pins `exceededTransferLimit:
 * true` forever (a CDN cache regression, a stuck cursor) would otherwise
 * loop indefinitely and exhaust memory; the bound trips first and rejects
 * with a clear error so the source records it and the caller backs off.
 */
const MAX_PAGES = 200

/**
 * Per-request timeout in milliseconds. A hung TCP connection (a silently
 * dropped TLS handshake, a black-hole proxy) would otherwise block the next
 * scan tick indefinitely. The shared `http-client.ts` already enforces this
 * for the queued sources; this raw client mirrors the policy.
 */
const REQUEST_TIMEOUT_MS = 60_000

export interface EncDirectClient {
  /** Bbox query against one (band, layerKey). Pages internally to completion. */
  queryLayer: (request: QueryRequest) => Promise<{ features: EncFeature[] }>
  /** Fetch a single feature by ArcGIS object id, or undefined when absent. */
  queryById: (request: QueryByIdRequest) => Promise<EncFeature | undefined>
}

export interface QueryRequest {
  band: ScaleBand
  layerKey: EncLayerKey
  bbox: Bbox
}

export interface QueryByIdRequest {
  band: ScaleBand
  layerKey: EncLayerKey
  objectId: number
}

export interface EncDirectClientConfig {
  baseUrl?: string
}

interface ArcGisFeatureCollection {
  features?: EncFeature[]
  exceededTransferLimit?: boolean
}

function fetchJson (url: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transport = url.startsWith('https:') ? httpsRequest : httpRequest
    const req = transport(url, { method: 'GET', headers }, res => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        const status = res.statusCode ?? 0
        if (status < 200 || status >= 300) {
          reject(new Error(`ENC Direct HTTP ${status} for ${url}`))
          return
        }
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    })
    // A silently dropped connection (no FIN, no RST) would otherwise hang
    // forever; the explicit timeout aborts and rejects the request.
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`ENC Direct request timed out after ${REQUEST_TIMEOUT_MS} ms: ${url}`))
    })
    req.on('error', reject)
    req.end()
  })
}

function buildBboxUrl (
  base: string,
  band: ScaleBand,
  layerId: number,
  bbox: Bbox,
  offset: number
): string {
  const params = new URLSearchParams({
    geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE)
  })
  return `${base}/arcgis/rest/services/encdirect/enc_${band}/MapServer/${layerId}/query?${params.toString()}`
}

function buildByIdUrl (
  base: string,
  band: ScaleBand,
  layerId: number,
  objectId: number
): string {
  const params = new URLSearchParams({
    objectIds: String(objectId),
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson'
  })
  return `${base}/arcgis/rest/services/encdirect/enc_${band}/MapServer/${layerId}/query?${params.toString()}`
}

export function createEncDirectClient (
  config: EncDirectClientConfig = {}
): EncDirectClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  const headers = { 'User-Agent': USER_AGENT }
  return {
    async queryLayer ({ band, layerKey, bbox }) {
      const layerId = LAYER_IDS_BY_BAND[band][layerKey]
      const all: EncFeature[] = []
      let offset = 0
      // Bounded pagination loop: a misbehaving server pinning
      // exceededTransferLimit forever would otherwise loop indefinitely.
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = buildBboxUrl(baseUrl, band, layerId, bbox, offset)
        const json = await fetchJson(url, headers) as ArcGisFeatureCollection
        const features = json.features ?? []
        for (const feature of features) all.push(feature)
        if (json.exceededTransferLimit !== true || features.length === 0) {
          return { features: all }
        }
        offset += features.length
      }
      throw new Error(
        `ENC Direct pagination exceeded ${MAX_PAGES} pages for ${band}/${layerKey}; ` +
        'the upstream may be pinning exceededTransferLimit incorrectly'
      )
    },
    async queryById ({ band, layerKey, objectId }) {
      const layerId = LAYER_IDS_BY_BAND[band][layerKey]
      const url = buildByIdUrl(baseUrl, band, layerId, objectId)
      const json = await fetchJson(url, headers) as ArcGisFeatureCollection
      return (json.features ?? [])[0]
    }
  }
}
